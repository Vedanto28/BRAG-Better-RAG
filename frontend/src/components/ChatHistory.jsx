import React, { useEffect, useRef } from 'react';
import LoadingBubble from './LoadingBubble.jsx';
import MessageBubble from './MessageBubble.jsx';
import { Terminal, Sparkles, Shield, Cpu, Zap, KeyRound } from 'lucide-react';

export default function ChatHistory({ history, loading, onOpenByok }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [history, loading]);

  if (history.length === 0 && !loading) {
    return (
      <section className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 text-center select-none">
        <div className="max-w-xl flex flex-col items-center gap-5 animate-fadeIn">
          {/* Mechamaru tactical glyph */}
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#7c5cff] to-[#8a74ff] flex items-center justify-center text-white shadow-xl shadow-[#7c5cff]/25 border border-[#8a74ff]/30">
            <Terminal className="w-6 h-6" />
          </div>

          <div className="flex flex-col gap-2">
            <div className="inline-flex items-center gap-1.5 self-center bg-[#7c5cff]/10 border border-[#7c5cff]/20 px-3 py-1 rounded-full text-[11px] font-mono text-[#a18dff]">
              <Sparkles className="w-3 h-3 text-[#8a74ff]" />
              <span>Mechamaru Live Console</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[#f5f7fa]">
              Better RAG Agentic Investigator
            </h2>
            <p className="text-xs md:text-sm text-[#a5adbb] leading-relaxed max-w-md">
              Ask questions about the connected repository, run diagnostic evidence pipelines, or inspect code and failure patterns.
            </p>
          </div>

          {/* Quick prompt suggestions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full mt-2">
            <div className="p-3 bg-[#131519] border border-[#1b1e24] hover:border-[#7c5cff]/40 rounded-xl text-left transition-all">
              <div className="text-xs font-semibold text-[#f5f7fa] flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-[#8a74ff]" />
                <span>Architecture Inspection</span>
              </div>
              <p className="text-[11px] text-[#6c7280] mt-1 font-mono">
                "Where is the orchestrator configured?"
              </p>
            </div>

            <div className="p-3 bg-[#131519] border border-[#1b1e24] hover:border-[#7c5cff]/40 rounded-xl text-left transition-all">
              <div className="text-xs font-semibold text-[#f5f7fa] flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#34d399]" />
                <span>Verification Check</span>
              </div>
              <p className="text-[11px] text-[#6c7280] mt-1 font-mono">
                "Reply with exactly: BRAG_OK"
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-live="polite"
      aria-relevant="additions text"
      className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-5"
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        {history.map((entry) => (
          <MessageBubble
            key={entry.id}
            role={entry.role}
            content={entry.content}
            metadata={entry.metadata}
            timestamp={entry.timestamp}
          />
        ))}
        {loading && <LoadingBubble />}
        <div ref={scrollRef} />
      </div>
    </section>
  );
}
