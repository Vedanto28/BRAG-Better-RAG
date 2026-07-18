import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { GitProvider } from './gitProvider.js';
import { redactSecrets } from '../utils/logParser.js';

const execFilePromise = promisify(execFile);

export class LocalGitProvider extends GitProvider {
  constructor(rootPath) {
    super();
    if (!rootPath) {
      throw new Error("REPO_ROOT_PATH is not configured.");
    }
    this.rootPath = path.resolve(rootPath);
  }

  /**
   * Helper to verify if the configured path is indeed inside a git repository.
   * @private
   */
  async _checkGitRepo() {
    try {
      await execFilePromise('git', ['rev-parse', '--is-inside-work-tree'], { cwd: this.rootPath });
    } catch (err) {
      throw new Error(`The path "${this.rootPath}" is not inside a git repository.`);
    }
  }

  /**
   * Helper to redact sensitive keys and passwords from diff text.
   * @private
   */
  _redactSecrets(diffText) {
    return redactSecrets(diffText);
  }

  /**
   * Helper to truncate filesChanged list and append a warning if it exceeds 20.
   * @private
   */
  _truncateFilesList(files) {
    if (!Array.isArray(files)) return [];
    const originalLength = files.length;
    if (originalLength > 20) {
      const sliced = files.slice(0, 20);
      sliced.push(`[WARNING: filesChanged list truncated. ${originalLength - 20} more files changed.]`);
      return sliced;
    }
    return files;
  }

  /**
   * Retrieves recent commits from the repository.
   */
  async getRecentCommits(options = {}) {
    await this._checkGitRepo();

    const limit = Math.min(options.limit || 10, 30);
    const args = ['log', '--name-only', '--pretty=format:COMMIT:%H|%h|%an|%ad|%s', '--date=iso'];

    if (options.since && typeof options.since === 'string') {
      if (/^[a-zA-Z0-9\s\-\.\:]+$/.test(options.since)) {
        args.push(`--since=${options.since}`);
      } else {
        throw new Error("Invalid format for 'since' option.");
      }
    }

    args.push('-n', String(limit));

    try {
      const { stdout } = await execFilePromise('git', args, { cwd: this.rootPath });
      const lines = stdout.split('\n');
      const commits = [];
      let currentCommit = null;

      for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        if (line.startsWith('COMMIT:')) {
          const parts = line.slice(7).split('|');
          currentCommit = {
            hash: parts[0] || '',
            shortHash: parts[1] || '',
            author: parts[2] || '',
            date: parts[3] || '',
            message: parts.slice(4).join('|') || '',
            filesChanged: []
          };
          commits.push(currentCommit);
        } else if (currentCommit) {
          currentCommit.filesChanged.push(line);
        }
      }

      // Truncate files list per commit if needed
      for (const commit of commits) {
        commit.filesChanged = this._truncateFilesList(commit.filesChanged);
      }

      return commits;
    } catch (error) {
      throw new Error(`Failed to get recent commits: ${error.message}`);
    }
  }

  /**
   * Inspects a specific commit by hash.
   */
  async inspectCommit(commitHash) {
    if (!commitHash || typeof commitHash !== 'string' || !/^[0-9a-fA-F]{7,40}$/.test(commitHash)) {
      throw new Error("Invalid commit hash format.");
    }

    await this._checkGitRepo();

    try {
      // 1. Get commit metadata and files changed
      const showMetaArgs = ['show', '--name-only', '--pretty=format:%H|%h|%an|%ad|%s', '--date=iso', commitHash];
      const { stdout: metaStdout } = await execFilePromise('git', showMetaArgs, { cwd: this.rootPath });
      
      const metaLines = metaStdout.split('\n').map(l => l.trim()).filter(Boolean);
      if (metaLines.length === 0) {
        throw new Error("Commit not found.");
      }

      const parts = metaLines[0].split('|');
      const metadata = {
        hash: parts[0] || '',
        shortHash: parts[1] || '',
        author: parts[2] || '',
        date: parts[3] || '',
        message: parts.slice(4).join('|') || ''
      };

      const rawFilesChanged = metaLines.slice(1);
      const filesChanged = this._truncateFilesList(rawFilesChanged);

      // 2. Get short stat summary
      const statArgs = ['show', '--shortstat', '--pretty=format:', commitHash];
      const { stdout: statStdout } = await execFilePromise('git', statArgs, { cwd: this.rootPath });
      const diffSummary = statStdout.trim();

      // 3. Get the unified patch/diff
      const diffArgs = ['show', '--patch', '--pretty=format:', commitHash];
      const { stdout: diffStdout } = await execFilePromise('git', diffArgs, { cwd: this.rootPath });
      
      let diff = diffStdout;
      let truncated = false;
      if (diff.length > 4000) {
        diff = diff.slice(0, 4000);
        truncated = true;
      }

      // Redact likely secrets from the diff content
      diff = this._redactSecrets(diff);

      if (truncated) {
        diff += "\n\n[WARNING: Diff output truncated due to size limits (~4000 characters).]";
      }

      return {
        ...metadata,
        filesChanged,
        diffSummary,
        diff
      };
    } catch (error) {
      throw new Error(`Failed to inspect commit ${commitHash}: ${error.message}`);
    }
  }
}

export default LocalGitProvider;
