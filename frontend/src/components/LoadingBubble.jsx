import React from 'react';
import { Bot, Loader2 } from 'lucide-react';

export default function LoadingBubble() {
  return (
    <article className="flex w-full gap-3 flex-row animate-fadeIn" aria-live="polite" aria-busy="true">
      <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#7c5cff] to-[#8a74ff] text-white flex items-center justify-center flex-shrink-0 text-xs font-bold shadow-md shadow-[#7c5cff]/20">
        <Bot className="w-4 h-4" />
      </div>

      <div className="flex flex-col gap-1.5 max-w-[85%] md:max-w-[75%] items-start">
        <div className="flex items-center gap-2 px-1 text-[11px] font-mono text-[#6c7280]">
          <span className="font-semibold uppercase tracking-wider text-[#a5adbb]">Mechamaru</span>
          <span className="text-[#a18dff] flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            reasoning...
          </span>
        </div>

        <div className="px-4 py-3.5 rounded-xl border bg-[#131519] border-[#1b1e24] text-[#a5adbb] flex items-center gap-3">
          <span className="text-xs font-mono">Executing retrieval & diagnostic pipeline</span>
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#7c5cff]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8a74ff] [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#a18dff] [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    </article>
  );
}
