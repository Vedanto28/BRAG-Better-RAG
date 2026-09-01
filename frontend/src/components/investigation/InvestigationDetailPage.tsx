import React, { useState } from 'react';
import {
  Send, Plus, AtSign, CheckCircle2, Circle, Search, ArrowRight, Bot,
  FileCode2, FileText, Terminal, Download, Share2, Sparkles, AlertCircle,
  Copy, Check, ChevronDown, ShieldCheck, Zap
} from 'lucide-react';
import { Button, Card, Badge, useToast } from '../common';
import { mockInvestigations } from '../../mockData';

export interface InvestigationDetailProps {
  investigationId: string;
  onBack: () => void;
}

export const InvestigationDetailPage: React.FC<InvestigationDetailProps> = ({
  investigationId,
  onBack,
}) => {
  const investigation =
    mockInvestigations.find((i) => i.id === investigationId) || mockInvestigations[0];
  const [messages, setMessages] = useState([
    {
      id: 'm1',
      sender: 'user',
      text: "We've been seeing sporadic 504 Gateway Timeouts on the `/api/v2/checkout/process` endpoint over the last 48 hours. Database load looks normal. Attached Datadog trace logs.",
      evidenceChip: 'Datadog Trace ERR_REDIS_MAX_CLIENTS',
    },
    {
      id: 'm2',
      sender: 'assistant',
      text: 'Initiating diagnostic flow across repository and active MCP telemetry streams...',
    },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const { addToast } = useToast();

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    const userMsg = { id: `m_${Date.now()}`, sender: 'user', text: inputVal };
    setMessages((prev) => [...prev, userMsg]);
    setInputVal('');

    setTimeout(() => {
      const assistantMsg = {
        id: `m_asst_${Date.now()}`,
        sender: 'assistant',
        text: 'Inspecting recent commit history and searching for Redis pool instantiation parameters in codebase...',
      };
      setMessages((prev) => [...prev, assistantMsg]);
    }, 800);
  };

  const handleExport = (format: string) => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      addToast({
        type: 'success',
        title: `Report Exported as ${format.toUpperCase()}`,
        description: 'Diagnostic report downloaded successfully.',
      });
    }, 1000);
  };

  const handleCopyReport = () => {
    setCopied(true);
    addToast({ type: 'info', title: 'Report Copied to Clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#0c0d10] text-[#f5f7fa] overflow-hidden rounded-xl border border-[#1b1e24] animate-fadeIn">
      {/* Top Console Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#1b1e24] bg-[#131519] flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-xs text-[#a5adbb] hover:text-[#f5f7fa] flex items-center gap-1">
            ← History
          </button>
          <span className="text-[#24272f]">|</span>
          <span className="font-mono text-xs font-semibold text-[#8a74ff] bg-[#191c22] border border-[#24272f] px-2 py-0.5 rounded">
            {investigation.id}
          </span>
          <h2 className="text-sm font-semibold text-[#f5f7fa] truncate max-w-md">{investigation.title}</h2>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="emerald" label="Telemetry Live" pulse />
          <div className="relative group">
            <Button
              variant="secondary"
              size="sm"
              isLoading={isExporting}
              leftIcon={<Download className="w-3.5 h-3.5" />}
            >
              Export Report
            </Button>
            <div className="absolute right-0 top-full mt-1 hidden group-hover:flex flex-col bg-[#191c22] border border-[#24272f] rounded-lg shadow-xl p-1 z-20 w-36 text-xs">
              <button onClick={() => handleExport('markdown')} className="px-3 py-1.5 text-left text-[#a5adbb] hover:text-[#f5f7fa] hover:bg-[#20242c] rounded">
                Markdown (.md)
              </button>
              <button onClick={() => handleExport('json')} className="px-3 py-1.5 text-left text-[#a5adbb] hover:text-[#f5f7fa] hover:bg-[#20242c] rounded">
                JSON Telemetry
              </button>
              <button onClick={() => handleExport('pdf')} className="px-3 py-1.5 text-left text-[#a5adbb] hover:text-[#f5f7fa] hover:bg-[#20242c] rounded">
                PDF Report
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main 3-Pane Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Pane A: Investigation Timeline (Left Sidebar) */}
        <div className="w-64 border-r border-[#1b1e24] bg-[#111317] p-4 flex flex-col gap-4 overflow-y-auto hidden lg:flex flex-shrink-0">
          <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#6c7280]">
            Diagnostic Pipeline
          </div>

          <div className="flex flex-col gap-0">
            {investigation.steps.map((step, idx) => {
              const isLast = idx === investigation.steps.length - 1;
              return (
                <div key={step.id} className="flex gap-3 pb-4 relative">
                  {!isLast && (
                    <div className="absolute left-[7px] top-4 bottom-0 w-0.5 bg-[#24272f]" />
                  )}
                  <div className="w-4 h-4 rounded-full bg-[#10b981]/20 border border-[#10b981] flex items-center justify-center flex-shrink-0 mt-0.5 z-10">
                    <CheckCircle2 className="w-3 h-3 text-[#10b981]" />
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-xs font-medium text-[#f5f7fa]">{step.stage}</span>
                    <span className="text-[11px] text-[#6c7280] line-clamp-1">{step.label}</span>
                    {step.durationMs && (
                      <span className="text-[10px] font-mono text-[#a18dff]">{(step.durationMs / 1000).toFixed(1)}s</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pane B: Interactive Chat & Evidence Input (Middle Workspace) */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0c0d10]">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-3 max-w-2xl ${m.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                    m.sender === 'assistant'
                      ? 'bg-gradient-to-tr from-[#7c5cff] to-[#8a74ff] text-white'
                      : 'bg-[#20242c] text-[#a5adbb] border border-[#24272f]'
                  }`}
                >
                  {m.sender === 'assistant' ? 'M' : 'U'}
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="text-[11px] font-medium text-[#6c7280]">
                    {m.sender === 'assistant' ? 'Mechamaru AI Specialist' : 'Engineer'}
                  </div>
                  <div
                    className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                      m.sender === 'user'
                        ? 'bg-[#191c22] border border-[#24272f] text-[#f5f7fa] rounded-tr-xs'
                        : 'bg-[#111317] border border-[#1b1e24] text-[#a5adbb] rounded-tl-xs'
                    }`}
                  >
                    {m.text}
                  </div>
                  {m.evidenceChip && (
                    <div className="inline-flex items-center gap-2 bg-[#191c22] border border-[#24272f] px-3 py-1.5 rounded-lg text-xs font-mono text-[#fb7185] self-start mt-1">
                      <FileCode2 className="w-3.5 h-3.5" />
                      <span>{m.evidenceChip}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Tactical Input Area */}
          <form onSubmit={handleSend} className="p-4 border-t border-[#1b1e24] bg-[#131519]">
            <div className="flex items-center bg-[#0f1115] border border-[#24272f] focus-within:border-[#8a74ff] rounded-xl px-3.5 py-2.5 gap-2 transition-all">
              <button
                type="button"
                className="text-[#6c7280] hover:text-[#8a74ff] p-1 rounded transition-colors"
                title="Attach Log / Stack Trace / Repo File"
              >
                <Plus className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="What is your backend trying to hide today?"
                className="flex-1 bg-transparent text-sm text-[#f5f7fa] placeholder-[#6c7280] focus:outline-none"
              />
              <Button variant="primary" size="sm" type="submit">
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </form>
        </div>

        {/* Pane C: Refined Diagnostic Report (Right Panel) */}
        {investigation.report && (
          <div className="w-96 border-l border-[#1b1e24] bg-[#111317] p-6 flex flex-col gap-6 overflow-y-auto hidden xl:flex flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#8a74ff]" />
                <h3 className="text-sm font-semibold text-[#f5f7fa]">Diagnostic Report</h3>
              </div>
              <Badge variant="emerald" label={`Confidence: ${investigation.report.confidence}%`} size="sm" />
            </div>

            {/* Hypothesis */}
            <div className="flex flex-col gap-2 bg-[#191c22] border border-[#24272f] p-4 rounded-xl">
              <span className="text-xs font-mono font-semibold uppercase text-[#a18dff]">Hypothesis</span>
              <p className="text-xs text-[#a5adbb] leading-relaxed">{investigation.report.hypothesis}</p>
            </div>

            {/* Evidence Stack */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-mono font-semibold uppercase text-[#6c7280]">Key Evidence</span>
              {investigation.evidence.map((ev) => (
                <div key={ev.id} className="p-3 bg-[#0f1115] border border-[#24272f] rounded-lg flex flex-col gap-1 text-xs">
                  <div className="flex items-center justify-between text-[#8a74ff] font-mono text-[11px]">
                    <span>{ev.title}</span>
                    <span>{ev.lineRange}</span>
                  </div>
                  <div className="font-mono text-[11px] text-[#6c7280] truncate">{ev.source}</div>
                  {ev.snippet && (
                    <div className="mt-1 bg-[#131519] p-2 rounded text-[10px] font-mono text-[#f5f7fa] overflow-x-auto">
                      {ev.snippet}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Assessment */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-mono font-semibold uppercase text-[#6c7280]">Root Cause Assessment</span>
              <p className="text-xs text-[#a5adbb] leading-relaxed bg-[#191c22] p-3.5 rounded-xl border border-[#24272f]">
                {investigation.report.assessment}
              </p>
            </div>

            {/* Next Steps */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-mono font-semibold uppercase text-[#34d399]">Remediation Steps</span>
              <div className="flex flex-col gap-2">
                {investigation.report.nextSteps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-[#a5adbb] bg-[#191c22] p-2.5 rounded-lg border border-[#24272f]">
                    <span className="font-mono text-[#34d399] font-bold">0{i + 1}</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Report Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-[#1b1e24]">
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                leftIcon={copied ? <Check className="w-3.5 h-3.5 text-[#10b981]" /> : <Copy className="w-3.5 h-3.5" />}
                onClick={handleCopyReport}
              >
                {copied ? 'Copied' : 'Copy Summary'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
