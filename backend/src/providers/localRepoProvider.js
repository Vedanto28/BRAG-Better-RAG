import fs from 'node:fs';
import path from 'node:path';
import { RepoProvider } from './repoProvider.js';

export class LocalRepoProvider extends RepoProvider {
  constructor(rootPath) {
    super();
    if (!rootPath) {
      throw new Error("REPO_ROOT_PATH is not configured.");
    }
    this.rootPath = path.resolve(rootPath);
  }

  /**
   * Resolves and validates a relative path to ensure it is within the repository root
   * and does not point to an ignored directory.
   * @param {string} inputPath - The input path from the user or tool.
   * @returns {string} - The resolved absolute path.
   * @private
   */
  _validatePath(inputPath) {
    // Resolve path relative to repoRoot
    const resolvedPath = path.resolve(this.rootPath, inputPath || '');

    // Check path traversal: target must be inside rootPath (or be the root itself)
    const relative = path.relative(this.rootPath, resolvedPath);
    const isSafe = relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));

    if (!isSafe) {
      throw new Error("Access denied: Path escapes repository root.");
    }

    // Check if path is in ignored directories
    if (this._isIgnored(resolvedPath)) {
      throw new Error(`Access denied: Path '${inputPath}' is in an ignored directory.`);
    }

    return resolvedPath;
  }

  /**
   * Checks if a path lies inside an ignored directory.
   * @param {string} resolvedPath
   * @returns {boolean}
   * @private
   */
  _isIgnored(resolvedPath) {
    const relative = path.relative(this.rootPath, resolvedPath);
    if (relative === '') return false;
    const segments = relative.split(path.sep);
    const ignoredNames = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.cache', 'out', '.DS_Store']);
    return segments.some(segment => ignoredNames.has(segment));
  }

  /**
   * Lists files and directories in the subPath.
   * @param {string} [subPath]
   * @returns {Promise<Array<{ name: string, path: string, isDirectory: boolean }>>}
   */
  async listFiles(subPath) {
    const targetPath = this._validatePath(subPath);

    try {
      const stats = await fs.promises.stat(targetPath);
      if (!stats.isDirectory()) {
        throw new Error("Specified path is not a directory.");
      }

      const entries = await fs.promises.readdir(targetPath, { withFileTypes: true });
      const results = [];

      for (const entry of entries) {
        const fullPath = path.join(targetPath, entry.name);

        // Skip ignored paths
        if (this._isIgnored(fullPath)) {
          continue;
        }

        results.push({
          name: entry.name,
          path: path.relative(this.rootPath, fullPath).replace(/\\/g, '/'),
          isDirectory: entry.isDirectory()
        });
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  /**
   * Reads a text file, applying size/line limits and preventing reading binary files.
   * @param {string} filePath
   * @returns {Promise<string>}
   */
  async readFile(filePath) {
    const targetPath = this._validatePath(filePath);

    try {
      const stats = await fs.promises.stat(targetPath);
      if (stats.isDirectory()) {
        throw new Error("Cannot read a directory as a file.");
      }

      // Check if file is binary by inspecting the first 1024 bytes
      const fd = await fs.promises.open(targetPath, 'r');
      let isBinary = false;
      try {
        const buffer = Buffer.alloc(1024);
        const { bytesRead } = await fd.read(buffer, 0, 1024, 0);
        for (let i = 0; i < bytesRead; i++) {
          if (buffer[i] === 0) {
            isBinary = true;
            break;
          }
        }
      } finally {
        await fd.close();
      }

      if (isBinary) {
        throw new Error("Cannot read binary file content.");
      }

      const maxBytes = 50 * 1024; // 50KB
      const maxLines = 1000;

      let content = await fs.promises.readFile(targetPath, 'utf8');
      let truncated = false;

      if (content.length > maxBytes) {
        content = content.slice(0, maxBytes);
        truncated = true;
      }

      const lines = content.split(/\r?\n/);
      if (lines.length > maxLines) {
        content = lines.slice(0, maxLines).join('\n');
        truncated = true;
      }

      if (truncated) {
        content += `\n\n[WARNING: File truncated. Showing first ${maxBytes / 1024}KB or ${maxLines} lines of original file content.]`;
      }

      return content;
    } catch (error) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  /**
   * Recursively searches for a query string in codebase files.
   * Caps results at 30 matches.
   * @param {string} query
   * @param {object} [options]
   * @param {string[]} [options.extensions]
   * @returns {Promise<{ matches: Array<{ path: string, line: number, text: string }>, hasMore: boolean }>}
   */
  async searchCode(query, options = {}) {
    if (!query) {
      throw new Error("Search query is required.");
    }
    const extensions = options.extensions || [];
    const limit = 30;
    const results = [];

    // Walk files recursively starting from the root path
    await this._searchDirectory(this.rootPath, query, extensions, results, limit + 1);

    const hasMore = results.length > limit;
    const finalResults = hasMore ? results.slice(0, limit) : results;

    return {
      matches: finalResults,
      hasMore
    };
  }

  /**
   * Helper to recursively scan a directory for code matches.
   * @private
   */
  async _searchDirectory(dirPath, query, extensions, results, limit) {
    let entries;
    try {
      entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    } catch (err) {
      return false; // Skip unreadable directories
    }

    for (const entry of entries) {
      if (results.length >= limit) {
        return true;
      }

      const fullPath = path.join(dirPath, entry.name);

      // Skip ignored paths
      if (this._isIgnored(fullPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        const reachedLimit = await this._searchDirectory(fullPath, query, extensions, results, limit);
        if (reachedLimit) {
          return true;
        }
      } else if (entry.isFile()) {
        // Filter by file extension if provided
        if (extensions && extensions.length > 0) {
          const ext = path.extname(entry.name).toLowerCase();
          const hasMatch = extensions.some(e => {
            const formatted = e.startsWith('.') ? e.toLowerCase() : `.${e.toLowerCase()}`;
            return ext === formatted;
          });
          if (!hasMatch) {
            continue;
          }
        }

        // Search in file if it is small and not binary
        try {
          const stats = await fs.promises.stat(fullPath);
          // Skip files larger than 1MB to avoid performance issues
          if (stats.size > 1024 * 1024) {
            continue;
          }

          // Check if binary
          const fd = await fs.promises.open(fullPath, 'r');
          let isBinary = false;
          try {
            const buffer = Buffer.alloc(1024);
            const { bytesRead } = await fd.read(buffer, 0, 1024, 0);
            for (let i = 0; i < bytesRead; i++) {
              if (buffer[i] === 0) {
                isBinary = true;
                break;
              }
            }
          } finally {
            await fd.close();
          }

          if (isBinary) {
            continue;
          }

          const content = await fs.promises.readFile(fullPath, 'utf8');
          const lines = content.split(/\r?\n/);
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(query)) {
              results.push({
                path: path.relative(this.rootPath, fullPath).replace(/\\/g, '/'),
                line: i + 1,
                text: lines[i]
              });
              if (results.length >= limit) {
                return true;
              }
            }
          }
        } catch (err) {
          // Ignore files that fail to read/stat
          continue;
        }
      }
    }
    return false;
  }
}

export default LocalRepoProvider;
