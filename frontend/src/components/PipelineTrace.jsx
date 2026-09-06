import React from 'react';
import { Database, GitBranch, ShieldAlert, Cpu, CheckCircle2, ChevronRight, Layers } from 'lucide-react';

export default function PipelineTrace({ metadata }) {
  if (!metadata) return null;

  const stages = [];

  // Stage 1: RAG Retrieval
  const ragActive = Boolean(metadata.contextFound || (metadata.debuggingMatches && metadata.debuggingMatches.length > 0));
  if (ragActive) {
    stages.push({
      id: 'rag',
      name: 'RAG Retrieval',
      icon: Database,
      color: 'text-[#34d399]',
      bg: 'bg-[#10b981]/10 border-[#10b981]/25',
      detail: metadata.debuggingMatches?.length ? `${metadata.debuggingMatches.length} patterns matched` : 'Grounding context retrieved'
    });
  }

  // Stage 2: Evidence Gate / Capability Planning
  if (metadata.complexity || metadata.mode) {
    stages.push({
      id: 'planner',
      name: 'Evidence Gate',
      icon: Layers,
      color: 'text-[#a18dff]',
      bg: 'bg-[#7c5cff]/10 border-[#7c5cff]/25',
      detail: metadata.complexity ? `${metadata.complexity} complexity (${metadata.mode || 'standard'})` : (metadata.mode || 'standard')
    });
  }

  // Stage 3: MCP Tools (Only when actual MCP tools were invoked)
  const hasTools = Boolean(
    (metadata.toolsUsed && metadata.toolsUsed.length > 0) ||
    (metadata.externalEvidence && metadata.externalEvidence.length > 0) ||
    (metadata.commitsInspected && metadata.commitsInspected.length > 0) ||
    (metadata.inspectedPaths && metadata.inspectedPaths.length > 0)
  );

  if (hasTools) {
    const toolList = metadata.toolsUsed || [];
    stages.push({
      id: 'mcp',
      name: 'MCP Evidence Layer',
      icon: GitBranch,
      color: 'text-[#60a5fa]',
      bg: 'bg-[#3b82f6]/10 border-[#3b82f6]/25',
      detail: toolList.length > 0 ? `${toolList.length} tools (${toolList.join(', ')})` : 'Repository & runtime tools'
    });
  }

  // Stage 4: Diagnostic Synthesis
  const providerName = metadata.provider && metadata.provider !== 'unknown' ? metadata.provider : 'Synthesis';
  const totalMs = metadata.observabilityTrace?.timing?.totalMs;
  stages.push({
    id: 'synthesis',
    name: 'Diagnostic Synthesis',
    icon: Cpu,
    color: 'text-[#fbbf24]',
    bg: 'bg-[#fbbf24]/10 border-[#fbbf24]/25',
    detail: totalMs ? `${providerName} (${totalMs}ms)` : providerName
  });

  return (
    <div className="w-full my-2 pt-2 pb-1 px-3 bg-[#0e1014] border border-[#1b1e24] rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[#6c7280] flex items-center gap-1.5">
          <CheckCircle2 className="w-3 h-3 text-[#34d399]" />
          Execution Trace
        </span>
        {totalMs && (
          <span className="text-[10px] font-mono text-[#6c7280]">
            {totalMs}ms latency
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
        {stages.map((stg, idx) => {
          const IconComponent = stg.icon;
          return (
            <React.Fragment key={stg.id}>
              <div
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] ${stg.bg}`}
                title={stg.detail}
              >
                <IconComponent className={`w-3 h-3 ${stg.color}`} />
                <span className="font-semibold text-[#f5f7fa]">{stg.name}</span>
                <span className="text-[#a5adbb] text-[9px] opacity-80">({stg.detail})</span>
              </div>
              {idx < stages.length - 1 && (
                <ChevronRight className="w-3 h-3 text-[#3d424d] flex-shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
