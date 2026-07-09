/**
 * Abstract class representing a repository provider.
 * Allows querying repository contents without direct filesystem dependency.
 */
export class RepoProvider {
  /**
   * Lists files and folders under the given subPath.
   * @param {string} [subPath] - The subpath to list contents from.
   * @returns {Promise<Array<{ name: string, path: string, isDirectory: boolean }>>}
   */
  async listFiles(subPath) {
    throw new Error("Method 'listFiles' must be implemented.");
  }

  /**
   * Reads the content of a file as UTF-8 text.
   * @param {string} filePath - The path of the file to read.
   * @returns {Promise<string>} - The file contents.
   */
  async readFile(filePath) {
    throw new Error("Method 'readFile' must be implemented.");
  }

  /**
   * Searches the codebase for a text query.
   * @param {string} query - The search term.
   * @param {object} [options]
   * @param {string[]} [options.extensions] - Optional list of file extensions to limit search.
   * @returns {Promise<{ matches: Array<{ path: string, line: number, text: string }>, hasMore: boolean }>}
   */
  async searchCode(query, options) {
    throw new Error("Method 'searchCode' must be implemented.");
  }
}
export default RepoProvider;
