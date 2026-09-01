import path from 'node:path';

/**
 * Standardizes absolute file paths in stack traces to relative paths relative to rootPath.
 * Also decodes URI encoded symbols and strips absolute filesystem prefixes to prevent leakage.
 * @param {string} rawPath
 * @param {string} rootPath
 * @returns {string}
 */
export function cleanFilePath(rawPath, rootPath) {
  let filePath = rawPath;
  // 1. Decode URI component encoding
  try {
    filePath = decodeURIComponent(filePath);
  } catch (e) {}

  // 2. Remove file:/// prefix
  if (filePath.startsWith('file:///')) {
    filePath = filePath.slice(8);
  } else if (filePath.startsWith('file://')) {
    filePath = filePath.slice(7);
  }

  // 3. Normalize slashes
  filePath = filePath.replace(/\\/g, '/');
  const rootDir = rootPath ? rootPath.replace(/\\/g, '/') : '';

  if (rootDir) {
    const lowerFilePath = filePath.toLowerCase();
    const lowerRootDir = rootDir.toLowerCase();
    if (lowerFilePath.startsWith(lowerRootDir)) {
      let rel = filePath.slice(rootDir.length);
      if (rel.startsWith('/')) rel = rel.slice(1);
      return rel;
    }
  }

  // 4. If path is absolute but not inside the root directory, return only the basename to prevent path leak
  if (path.isAbsolute(filePath) || /^[a-zA-Z]:\//.test(filePath)) {
    return path.basename(filePath);
  }
  return filePath;
}

// 2. Redact secrets using standard Prompt 2b regex
const secretRegex = /^(.*?\b[a-zA-Z0-9_\-]*?(key|secret|password|token)[a-zA-Z0-9_\-]*?\s*[:=]\s*["']?)[^\r\n"'\s]+(["']?.*)$/i;

export function redactSecrets(text) {
  if (!text) return '';
  const lines = text.split('\n');
  const redactedLines = lines.map(line => {
    if (line.includes('[REDACTED_USER_KEY]')) return line;
    if (secretRegex.test(line)) {
      return line.replace(secretRegex, '$1[REDACTED]$3');
    }
    return line;
  });
  return redactedLines.join('\n');
}

/**
 * Parses raw pasted error log or stack trace content.
 * Performs secrets redaction, length cap checks, and regex frame matching.
 * @param {string} logText
 * @returns {object}
 */
export function parseErrorLog(logText) {
  if (!logText || typeof logText !== 'string') {
    return {
      errorType: "Unknown",
      errorMessage: "No structured error pattern found",
      stackFrames: [],
      groupedOccurrences: 0,
      timestamps: []
    };
  }

  // 1. Cap input length at 10,000 characters
  let originalLength = logText.length;
  let truncatedNotice = "";
  if (originalLength > 10000) {
    logText = logText.slice(0, 10000);
    truncatedNotice = "Input log was truncated to 10,000 characters.";
  }

  logText = redactSecrets(logText);

  // 3. Extract timestamps
  const timestampRegex = /\b\d{4}[-/]\d{2}[-/]\d{2}(?:T|\s+)\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/gi;
  const foundTimestamps = logText.match(timestampRegex) || [];
  const uniqueTimestamps = Array.from(new Set(foundTimestamps)).slice(0, 20);

  // 4. Parse line-by-line
  const lines = logText.split('\n');
  const errorMap = new Map();
  const stackFrames = [];
  const rootPath = process.env.REPO_ROOT_PATH || "";

  // Stack frame patterns
  const frameWithFunc = /^\s*at\s+(?:async\s+)?([^\s(]+(?: [^(]+)?)\s+\((.*?):(\d+):(\d+)\)/;
  const frameWithoutFunc = /^\s*at\s+(?:async\s+)?(.*?):(\d+):(\d+)\s*$/;

  // Primary error type pattern
  const errorLineRegex = /(?:^|\b)([a-zA-Z0-9_$]*(?:Error|Exception|Rejection|Warning|ECONNREFUSED|EADDRINUSE))\s*:\s*(.*)/i;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // A. Parse stack frames (cap at 15)
    let frameMatch = line.match(frameWithFunc);
    if (frameMatch) {
      if (stackFrames.length < 15) {
        stackFrames.push({
          functionName: frameMatch[1],
          file: cleanFilePath(frameMatch[2], rootPath),
          line: parseInt(frameMatch[3], 10)
        });
      }
      continue;
    }

    frameMatch = line.match(frameWithoutFunc);
    if (frameMatch) {
      if (stackFrames.length < 15) {
        stackFrames.push({
          functionName: undefined,
          file: cleanFilePath(frameMatch[1], rootPath),
          line: parseInt(frameMatch[2], 10)
        });
      }
      continue;
    }

    // B. Parse error type/message
    // Strip timestamp or level prefix if present to make pattern matching cleaner
    const cleanedLine = line.replace(/^\b\d{4}[-/]\d{2}[-/]\d{2}(?:T|\s+)\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b\s*(?:UTC)?\s*(?:-\s*)?/, '')
                           .replace(/^\[.*?\]\s*/, '');
    const errorMatch = cleanedLine.match(errorLineRegex);
    if (errorMatch) {
      const type = errorMatch[1].trim();
      const message = errorMatch[2].trim();
      const key = `${type}::${message}`;
      errorMap.set(key, (errorMap.get(key) || 0) + 1);
    }
  }

  // 5. Select primary error
  let primaryType = "Unknown";
  let primaryMessage = "No structured error pattern found";
  let totalOccurrences = 0;

  if (errorMap.size > 0) {
    let maxCount = 0;
    for (const [key, count] of errorMap.entries()) {
      totalOccurrences += count;
      if (count > maxCount) {
        maxCount = count;
        const [type, message] = key.split('::');
        primaryType = type;
        primaryMessage = message;
      }
    }
  }

  // If stack frames exist but no explicit error type was found, default to "Error"
  if (primaryType === "Unknown" && stackFrames.length > 0) {
    primaryType = "Error";
    primaryMessage = "Stack trace pattern matched";
    totalOccurrences = 1;
  }

  let framesTruncationNotice = "";
  if (stackFrames.length >= 15) {
    framesTruncationNotice = "Stack frames output was truncated to 15 entries.";
  }

  return {
    errorType: primaryType,
    errorMessage: primaryMessage,
    stackFrames,
    groupedOccurrences: totalOccurrences,
    timestamps: uniqueTimestamps,
    truncatedNotice,
    framesTruncationNotice
  };
}

/**
 * Checks if a query represents a structured log or stack trace.
 * Must find structural patterns (e.g. stack frames, timestamped log lines, or repeated errors).
 * @param {string} query
 * @returns {boolean}
 */
export function isLogStructured(query) {
  if (!query || typeof query !== 'string') return false;

  // 1. Stack frame patterns (standard Node/JS stack trace lines)
  // e.g. "at startServer (d:\path\server.js:25:20)" or "at file:line:col"
  const stackFrameRegex = /\bat\s+(?:async\s+)?(?:[^\s(]+\s+\()?[^\s(]+:\d+:\d+/i;
  if (stackFrameRegex.test(query)) {
    return true;
  }

  const lines = query.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length >= 2) {
    // 2. Multiple lines containing timestamps
    const timestampRegex = /\b\d{4}[-/]\d{2}[-/]\d{2}(?:T|\s+)\d{2}:\d{2}:\d{2}/;
    let timestampCount = 0;
    let errorSignatureCount = 0;
    const errorLineRegex = /(?:[a-zA-Z0-9_$]*(?:Error|Exception|Rejection|Warning|ECONNREFUSED|EADDRINUSE))\s*:/i;

    for (const line of lines) {
      if (timestampRegex.test(line)) {
        timestampCount++;
      }
      if (errorLineRegex.test(line)) {
        errorSignatureCount++;
      }
    }
    if (timestampCount >= 2 || errorSignatureCount >= 2) {
      return true;
    }
  }

  return false;
}
