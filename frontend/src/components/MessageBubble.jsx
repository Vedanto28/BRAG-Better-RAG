import React from 'react';
import { Bot, User, Sparkles, Cpu, CheckCircle2, ShieldCheck, Database } from 'lucide-react';

export default function MessageBubble({ role, content, metadata, timestamp }) {
  const isUser = role === 'user';

  return (
    <article
      className={`flex w-full gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-fadeIn`}
      aria-label={isUser ? 'You' : 'Mechamaru'}
    >
      {/* Avatar */}
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold shadow-md ${
          isUser
            ? 'bg-[#20242c] text-[#a5adbb] border border-[#24272f]'
            : 'bg-gradient-to-tr from-[#7c5cff] to-[#8a74ff] text-white shadow-[#7c5cff]/20'
        }`}
      >
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Bubble Container */}
      <div className={`flex flex-col gap-1.5 max-w-[85%] md:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className="flex items-center gap-2 px-1 text-[11px] font-mono text-[#6c7280]">
          <span className="font-semibold uppercase tracking-wider text-[#a5adbb]">
            {isUser ? 'You' : 'Mechamaru'}
          </span>
          {timestamp && <span>{timestamp}</span>}
          {!isUser && metadata?.provider && metadata.provider !== 'unknown' && (
            <span className="inline-flex items-center gap-1 bg-[#7c5cff]/10 border border-[#7c5cff]/20 text-[#a18dff] px-1.5 py-0.2 rounded text-[10px] font-mono">
              <Cpu className="w-2.5 h-2.5" />
              {metadata.provider}
            </span>
          )}
        </div>

        <div
          className={`px-4 py-3 rounded-xl text-sm leading-relaxed border transition-colors ${
            isUser
              ? 'bg-[#191c22] border-[#24272f] text-[#f5f7fa]'
              : 'bg-[#131519] border-[#1b1e24] text-[#f5f7fa]'
          }`}
        >
          <div className="whitespace-pre-wrap break-words font-sans selection:bg-[#7c5cff]/30">
            {content}
          </div>

          {/* Diagnostic Metadata Footer for Mechamaru responses */}
          {!isUser && metadata && (
            <div className="mt-3 pt-2.5 border-t border-[#1b1e24] flex flex-wrap items-center gap-2 text-[10px] font-mono text-[#6c7280]">
              {metadata.contextFound && (
                <span className="inline-flex items-center gap-1 bg-[#10b981]/10 text-[#34d399] px-2 py-0.5 rounded border border-[#10b981]/20">
                  <Database className="w-2.5 h-2.5" />
                  RAG Context
                </span>
              )}
              {metadata.toolsUsed && metadata.toolsUsed.length > 0 && (
                <span className="inline-flex items-center gap-1 bg-[#3b82f6]/10 text-[#60a5fa] px-2 py-0.5 rounded border border-[#3b82f6]/20">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  Tools: {metadata.toolsUsed.join(', ')}
                </span>
              )}
              {metadata.mode && metadata.mode !== 'unknown' && (
                <span className="text-[#6c7280]">mode: {metadata.mode}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
