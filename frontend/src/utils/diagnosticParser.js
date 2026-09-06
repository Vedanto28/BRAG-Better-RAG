/**
 * Parses structured diagnostic outputs produced by the Mechamaru agent orchestrator.
 * Safely extracts Finding, Why this is happening, Root Cause, Confidence, What this means, Related Files, and Evidence.
 */
export function parseDiagnosticResponse(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { isStructured: false, rawText: text };
  }

  const sectionKeywords = [
    { key: 'finding', label: 'Finding', regex: /(?:^|\n)(?:#{1,4}\s*|\*{1,2})?Finding(?:\*{1,2})?:?\s*/i },
    { key: 'why', label: 'Why This Is Happening', regex: /(?:^|\n)(?:#{1,4}\s*|\*{1,2})?Why this is happening(?:\*{1,2})?:?\s*/i },
    { key: 'evidence', label: 'Evidence', regex: /(?:^|\n)(?:#{1,4}\s*|\*{1,2})?Evidence(?:\*{1,2})?:?\s*/i },
    { key: 'rootCause', label: 'Root Cause', regex: /(?:^|\n)(?:#{1,4}\s*|\*{1,2})?Root cause(?:\*{1,2})?:?\s*/i },
    { key: 'confidence', label: 'Confidence', regex: /(?:^|\n)(?:#{1,4}\s*|\*{1,2})?Confidence(?:\*{1,2})?:?\s*/i },
    { key: 'whatThisMeans', label: 'What This Means', regex: /(?:^|\n)(?:#{1,4}\s*|\*{1,2})?What this means(?:\*{1,2})?:?\s*/i },
    { key: 'relatedFiles', label: 'Related Files', regex: /(?:^|\n)(?:#{1,4}\s*|\*{1,2})?Related files(?:\*{1,2})?:?\s*/i },
  ];

  const matches = [];
  for (const s of sectionKeywords) {
    const match = s.regex.exec(text);
    if (match) {
      matches.push({
        key: s.key,
        label: s.label,
        index: match.index,
        headerLength: match[0].length
      });
    }
  }

  // If fewer than 2 standard diagnostic headers match, render as plain conversational text
  if (matches.length < 2) {
    return { isStructured: false, rawText: text };
  }

  matches.sort((a, b) => a.index - b.index);

  const sections = {};
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const startIndex = current.index + current.headerLength;
    const endIndex = (i + 1 < matches.length) ? matches[i + 1].index : text.length;
    const sectionContent = text.slice(startIndex, endIndex).trim();
    sections[current.key] = sectionContent;
  }

  let confidenceScore = null;
  if (sections.confidence) {
    const numMatch = sections.confidence.match(/(\d{1,3})%/);
    if (numMatch) {
      confidenceScore = parseInt(numMatch[1], 10);
    }
  }

  let relatedFilesList = [];
  if (sections.relatedFiles) {
    relatedFilesList = sections.relatedFiles
      .split('\n')
      .map(line => line.replace(/^[-*•\d.]\s*/, '').trim())
      .filter(line => line.length > 0 && !line.startsWith('('));
  }

  return {
    isStructured: true,
    sections,
    confidenceScore,
    relatedFilesList,
    rawText: text
  };
}
