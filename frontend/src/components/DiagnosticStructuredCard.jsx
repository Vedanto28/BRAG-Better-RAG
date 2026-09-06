import React from 'react';
import { 
  AlertCircle, 
  HelpCircle, 
  CheckCircle2, 
  FileCode, 
  Zap, 
  ShieldAlert, 
  TrendingUp, 
  Layers 
} from 'lucide-react';
import { parseDiagnosticResponse } from '../utils/diagnosticParser.js';

export default function DiagnosticStructuredCard({ content }) {
  const parsed = parseDiagnosticResponse(content);

  // If response is not structured diagnostic, render as clean standard markdown
  if (!parsed.isStructured) {
    return (
      <div className="whitespace-pre-wrap break-words font-sans selection:bg-[#7c5cff]/30 text-sm leading-relaxed">
        {content}
      </div>
    );
  }

  const { sections, confidenceScore, relatedFilesList } = parsed;

  return (
    <div className="space-y-3.5 w-full">
      {/* 1. Finding Card */}
      {sections.finding && (
        <div className="p-3 bg-[#131519] border border-[#7c5cff]/30 rounded-xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#a18dff] font-mono uppercase tracking-wider mb-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-[#8a74ff]" />
            <span>Finding</span>
          </div>
          <p className="text-sm text-[#f5f7fa] leading-relaxed font-sans">
            {sections.finding}
          </p>
        </div>
      )}

      {/* 2. Why This Is Happening (Technical Mechanism) */}
      {sections.why && (
        <div className="p-3 bg-[#101216] border border-[#1e222a] rounded-xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#a5adbb] font-mono uppercase tracking-wider mb-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-[#3b82f6]" />
            <span>Why This Is Happening</span>
          </div>
          <p className="text-sm text-[#cbd5e1] leading-relaxed font-sans whitespace-pre-wrap">
            {sections.why}
          </p>
        </div>
      )}

      {/* 3. Root Cause + Confidence Grid */}
      {(sections.rootCause || sections.confidence) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {sections.rootCause && (
            <div className={`p-3 bg-[#1a1418] border border-[#fb7185]/30 rounded-xl ${sections.confidence ? 'sm:col-span-2' : 'sm:col-span-3'}`}>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#fb7185] font-mono uppercase tracking-wider mb-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-[#fb7185]" />
                <span>Root Cause</span>
              </div>
              <p className="text-sm text-[#ffe4e6] leading-relaxed font-sans font-medium">
                {sections.rootCause}
              </p>
            </div>
          )}

          {sections.confidence && (
            <div className="p-3 bg-[#12161b] border border-[#38bdf8]/30 rounded-xl flex flex-col justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#38bdf8] font-mono uppercase tracking-wider mb-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-[#38bdf8]" />
                <span>Confidence</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-[#f5f7fa]">
                  {sections.confidence}
                </span>
              </div>
              {confidenceScore !== null && (
                <div className="w-full bg-[#1b222c] h-1.5 rounded-full overflow-hidden mt-2">
                  <div 
                    className="bg-gradient-to-r from-[#38bdf8] to-[#10b981] h-full rounded-full transition-all duration-500" 
                    style={{ width: `${confidenceScore}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. What This Means (Impact Assessment) */}
      {sections.whatThisMeans && (
        <div className="p-3 bg-[#101216] border border-[#1e222a] rounded-xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#fbbf24] font-mono uppercase tracking-wider mb-1.5">
            <Zap className="w-3.5 h-3.5 text-[#fbbf24]" />
            <span>What This Means</span>
          </div>
          <p className="text-sm text-[#cbd5e1] leading-relaxed font-sans whitespace-pre-wrap">
            {sections.whatThisMeans}
          </p>
        </div>
      )}

      {/* 5. Related Files */}
      {relatedFilesList && relatedFilesList.length > 0 && (
        <div className="p-3 bg-[#0d0f12] border border-[#1b1e24] rounded-xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#a5adbb] font-mono uppercase tracking-wider mb-2">
            <FileCode className="w-3.5 h-3.5 text-[#60a5fa]" />
            <span>Related Files</span>
          </div>
          <div className="flex flex-wrap gap-1.5 font-mono text-xs">
            {relatedFilesList.map((file, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 bg-[#171a21] border border-[#242935] text-[#93c5fd] px-2.5 py-1 rounded-lg hover:border-[#60a5fa]/50 transition-colors"
              >
                <FileCode className="w-3 h-3 text-[#60a5fa]" />
                {file}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
