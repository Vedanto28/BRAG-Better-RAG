import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  Database, 
  FileCode, 
  Terminal, 
  GitCommit, 
  Eye, 
  Sparkles, 
  ExternalLink,
  ShieldCheck,
  Code
} from 'lucide-react';

export default function EvidenceDrawer({ metadata, inlineEvidenceText }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  if (!metadata && !inlineEvidenceText) return null;

  // Build categorized evidence items from metadata and parsed evidence
  const evidenceItems = [];

  // 1. Observed Facts (Logs, error parser frames, runtime errors)
  if (metadata?.logEvidence?.errorType) {
    evidenceItems.push({
      id: 'log-error',
      category: 'Observed Fact',
      categoryColor: 'bg-[#fb7185]/10 text-[#fb7185] border-[#fb7185]/20',
      source: 'logParser:parseErrorLog',
      title: `Error Log: ${metadata.logEvidence.errorType}`,
      detail: `${metadata.logEvidence.groupedOccurrences || 1} occurrence(s) recorded`,
      frames: metadata.logEvidence.framesReferenced || [],
      type: 'runtime_log'
    });
  }

  // 2. Repository Facts (Inspected paths, files, commits)
  if (Array.isArray(metadata?.inspectedPaths) && metadata.inspectedPaths.length > 0) {
    metadata.inspectedPaths.forEach((path, idx) => {
      evidenceItems.push({
        id: `path-${idx}`,
        category: 'Repository Fact',
        categoryColor: 'bg-[#3b82f6]/10 text-[#60a5fa] border-[#3b82f6]/20',
        source: 'fs:readFile / searchCode',
        title: `Inspected File: ${path}`,
        detail: 'Code inspected and verified in repository',
        type: 'repository_file'
      });
    });
  }

  if (Array.isArray(metadata?.commitsInspected) && metadata.commitsInspected.length > 0) {
    metadata.commitsInspected.forEach((commit, idx) => {
      evidenceItems.push({
        id: `commit-${idx}`,
        category: 'Repository Fact',
        categoryColor: 'bg-[#3b82f6]/10 text-[#60a5fa] border-[#3b82f6]/20',
        source: 'git:getRecentCommits / inspectCommit',
        title: `Git Commit: ${commit}`,
        detail: 'Commit history inspected for recent changes',
        type: 'git_commit'
      });
    });
  }

  // 3. MCP External Evidence (GitHub, Chrome DevTools, Context7)
  if (Array.isArray(metadata?.externalEvidence) && metadata.externalEvidence.length > 0) {
    metadata.externalEvidence.forEach((ext, idx) => {
      evidenceItems.push({
        id: `ext-${idx}`,
        category: ext.evidenceType === 'observed' ? 'Observed Fact' : 'Repository Fact',
        categoryColor: 'bg-[#a855f7]/10 text-[#c084fc] border-[#a855f7]/20',
        source: `MCP:${ext.provider || 'tool'}.${ext.toolName || 'execute'}`,
        title: ext.summary || `MCP Evidence (${ext.toolName})`,
        payload: ext.payload,
        type: 'mcp_payload'
      });
    });
  }

  // 4. Inferences (RAG Debugging matches, hypotheses)
  if (Array.isArray(metadata?.debuggingMatches) && metadata.debuggingMatches.length > 0) {
    metadata.debuggingMatches.forEach((matchId, idx) => {
      evidenceItems.push({
        id: `rag-${idx}`,
        category: 'Inference',
        categoryColor: 'bg-[#10b981]/10 text-[#34d399] border-[#10b981]/20',
        source: 'RAG:debuggingKnowledgeBase',
        title: `Diagnostic Pattern: ${matchId}`,
        detail: 'Matched known failure signature hypothesis',
        type: 'rag_match'
      });
    });
  }

  // 5. If inline text evidence exists from markdown response but no metadata items
  if (evidenceItems.length === 0 && inlineEvidenceText) {
    evidenceItems.push({
      id: 'inline-evidence',
      category: 'Inference',
      categoryColor: 'bg-[#10b981]/10 text-[#34d399] border-[#10b981]/20',
      source: 'Mechamaru Diagnostic Evidence',
      title: 'Synthesized Evidence Summary',
      detail: inlineEvidenceText,
      type: 'inline_text'
    });
  }

  if (evidenceItems.length === 0) return null;

  const filteredItems = activeTab === 'all'
    ? evidenceItems
    : evidenceItems.filter(item => {
        if (activeTab === 'observed') return item.category === 'Observed Fact';
        if (activeTab === 'repository') return item.category === 'Repository Fact';
        if (activeTab === 'inference') return item.category === 'Inference';
        return true;
      });

  return (
    <div className="w-full mt-3 border border-[#1b1e24] bg-[#0d0f12] rounded-xl overflow-hidden shadow-sm">
      {/* Header / Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-[#131519] hover:bg-[#181a20] transition-colors text-left cursor-pointer border-b border-[#1b1e24]"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 text-xs font-mono">
          <Database className="w-3.5 h-3.5 text-[#8a74ff]" />
          <span className="font-semibold text-[#f5f7fa]">Evidence Drawer</span>
          <span className="bg-[#7c5cff]/15 text-[#a18dff] px-1.5 py-0.2 rounded text-[10px] font-mono border border-[#7c5cff]/20">
            {evidenceItems.length} item{evidenceItems.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[#6c7280]">
          <span>{isOpen ? 'Collapse' : 'Expand'}</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5 text-[#8a74ff]" />}
        </div>
      </button>

      {/* Expanded Content */}
      {isOpen && (
        <div className="p-3 space-y-3 animate-fadeIn">
          {/* Category Tabs */}
          <div className="flex flex-wrap gap-1.5 border-b border-[#1b1e24] pb-2 text-[10px] font-mono">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                activeTab === 'all' ? 'bg-[#7c5cff] text-white font-medium' : 'bg-[#191c22] text-[#a5adbb] hover:text-[#f5f7fa]'
              }`}
            >
              All ({evidenceItems.length})
            </button>
            <button
              onClick={() => setActiveTab('observed')}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                activeTab === 'observed' ? 'bg-[#fb7185]/20 text-[#fb7185] border border-[#fb7185]/30' : 'bg-[#191c22] text-[#a5adbb] hover:text-[#f5f7fa]'
              }`}
            >
              Observed Facts
            </button>
            <button
              onClick={() => setActiveTab('repository')}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                activeTab === 'repository' ? 'bg-[#3b82f6]/20 text-[#60a5fa] border border-[#3b82f6]/30' : 'bg-[#191c22] text-[#a5adbb] hover:text-[#f5f7fa]'
              }`}
            >
              Repository Facts
            </button>
            <button
              onClick={() => setActiveTab('inference')}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                activeTab === 'inference' ? 'bg-[#10b981]/20 text-[#34d399] border border-[#10b981]/30' : 'bg-[#191c22] text-[#a5adbb] hover:text-[#f5f7fa]'
              }`}
            >
              Inferences
            </button>
          </div>

          {/* Evidence List */}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="p-2.5 bg-[#131519] border border-[#1e222a] rounded-lg text-xs flex flex-col gap-1.5 hover:border-[#2a2e38] transition-colors"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold ${item.categoryColor}`}>
                    {item.category}
                  </span>
                  <span className="text-[10px] font-mono text-[#6c7280]">
                    src: {item.source}
                  </span>
                </div>

                <div className="font-medium text-[#f5f7fa] flex items-center gap-1.5 font-mono text-[11px]">
                  {item.type === 'repository_file' && <FileCode className="w-3.5 h-3.5 text-[#60a5fa]" />}
                  {item.type === 'git_commit' && <GitCommit className="w-3.5 h-3.5 text-[#fbbf24]" />}
                  {item.type === 'runtime_log' && <Terminal className="w-3.5 h-3.5 text-[#fb7185]" />}
                  {item.type === 'rag_match' && <Database className="w-3.5 h-3.5 text-[#34d399]" />}
                  {item.type === 'mcp_payload' && <Sparkles className="w-3.5 h-3.5 text-[#c084fc]" />}
                  <span>{item.title}</span>
                </div>

                {item.detail && (
                  <p className="text-[11px] text-[#a5adbb] whitespace-pre-wrap leading-relaxed font-sans">
                    {item.detail}
                  </p>
                )}

                {item.frames && item.frames.length > 0 && (
                  <div className="mt-1 p-2 bg-[#090a0c] border border-[#1b1e24] rounded text-[10px] font-mono text-[#a5adbb] space-y-1">
                    <span className="text-[#6c7280] font-semibold">Referenced Frames:</span>
                    {item.frames.map((f, fIdx) => (
                      <div key={fIdx} className="text-[#38bdf8]">
                        at {f.functionName || '<anonymous>'} ({f.file}:{f.line})
                      </div>
                    ))}
                  </div>
                )}

                {item.payload && (
                  <div className="mt-1 p-2 bg-[#090a0c] border border-[#1b1e24] rounded text-[10px] font-mono text-[#a5adbb] overflow-x-auto max-h-36">
                    <pre className="whitespace-pre-wrap break-words">
                      {typeof item.payload === 'object' ? JSON.stringify(item.payload, null, 2) : String(item.payload)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
