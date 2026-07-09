/**
 * Abstract class representing a Git provider.
 * Allows querying Git history and changes without direct child_process dependency.
 */
export class GitProvider {
  /**
   * Retrieves recent commits from the repository.
   * @param {object} [options]
   * @param {string} [options.since] - Optional date or relative time (e.g. '1.day.ago').
   * @param {number} [options.limit] - Optional maximum number of commits to retrieve.
   * @returns {Promise<Array<{ hash: string, shortHash: string, author: string, date: string, message: string, filesChanged: string[] }>>}
   */
  async getRecentCommits(options) {
    throw new Error("Method 'getRecentCommits' must be implemented.");
  }

  /**
   * Inspects a specific commit.
   * @param {string} commitHash - The hash of the commit to inspect.
   * @returns {Promise<{ hash: string, shortHash: string, author: string, date: string, message: string, filesChanged: string[], diffSummary: string, diff: string }>}
   */
  async inspectCommit(commitHash) {
    throw new Error("Method 'inspectCommit' must be implemented.");
  }
}

export default GitProvider;
