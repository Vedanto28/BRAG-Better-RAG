import React, { useState, useEffect, useCallback } from 'react';
import {
  Send, Plus, CheckCircle2, Search, ArrowRight, Bot,
  FileCode2, FileText, Terminal, Download, Share2, Sparkles, AlertCircle,
  Copy, Check, ChevronDown, ShieldCheck, Zap, Play, RefreshCw, Hash, CircleDot, Clock
} from 'lucide-react';
import { Button, Card, Badge, useToast } from '../common';
import { fetchInvestigationDetail, updateInvestigationStatusApi } from '../../services/chatService.js';
import MessageBubble from '../MessageBubble.jsx';
import EvidenceDrawer from '../EvidenceDrawer.jsx';

export interface InvestigationDetailProps {
  investigationId: string;
  onBack: () => void;
  onContinueInvestigation: (id: string) => void;
}

export const InvestigationDetailPage: React.FC<InvestigationDetailProps> = ({
  investigationId,
  onBack,
  onContinueInvestigation,
}) => {
  const [investigation, setInvestigation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { addToast } = useToast();

  const loadDetail = useCallback(async () => {
    if (!investigationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchInvestigationDetail(investigationId);
      if (res && res.investigation) {
        setInvestigation(res.investigation);
      } else {
        setError('Investigation data could not be parsed.');
      }
    } catch (err: any) {
      console.error('[Detail] Error loading investigation detail:', err);
      setError(err?.message || 'Failed to load investigation details.');
    } finally {
      setLoading(false);
    }
  }, [investigationId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleStatusToggle = async () => {
    if (!investigation) return;
    const nextStatus = investigation.status === 'completed' ? 'active' : 'completed';
    try {
      await updateInvestigationStatusApi(investigation.id, nextStatus);
      setInvestigation((prev: any) => ({ ...prev, status: nextStatus }));
      addToast({
        type: 'success',
        title: `Status Changed to ${nextStatus.toUpperCase()}`
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Status Update Failed',
        description: err?.message
      });
    }
  };

  const handleExport = (format: 'markdown' | 'json') => {
    if (!investigation) return;
    setIsExporting(true);

    try {
      let blob: Blob;
      let filename: string;

      if (format === 'json') {
        blob = new Blob([JSON.stringify(investigation, null, 2)], { type: 'application/json' });
        filename = `investigation-${investigation.id}.json`;
      } else {
        // Build Markdown Report
        let md = `# BRAG Diagnostic Report: ${investigation.title || 'Investigation'}\n\n`;
        md += `**Investigation ID:** ${investigation.id}\n`;
        md += `**Status:** ${investigation.status}\n`;
        md += `**Created:** ${investigation.created_at}\n\n`;
        md += `## Conversation & Diagnostic History\n\n`;

        if (Array.isArray(investigation.messages)) {
          investigation.messages.forEach((m: any) => {
            md += `### ${m.role === 'user' ? 'User Inquiry' : 'Mechamaru Diagnostic Finding'} (${m.created_at || ''})\n\n`;
            md += `${m.content}\n\n`;
          });
        }

        blob = new Blob([md], { type: 'text/markdown' });
        filename = `investigation-${investigation.id}.md`;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addToast({
        type: 'success',
        title: `Exported ${format.toUpperCase()} Report`,
        description: `Saved as ${filename}`
      });
    } catch (e: any) {
      addToast({
        type: 'error',
        title: 'Export Failed',
        description: e?.message
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyReport = () => {
    if (!investigation) return;
    let textToCopy = `BRAG Diagnostic Report: ${investigation.title}\nID: ${investigation.id}\nStatus: ${investigation.status}\n\n`;
    if (Array.isArray(investigation.messages)) {
      investigation.messages.forEach((m: any) => {
        textToCopy += `[${m.role.toUpperCase()}]:\n${m.content}\n\n`;
      });
    }
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    addToast({ type: 'info', title: 'Report Copied to Clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 gap-3 bg-[#0c0d10] text-[#a5adbb]">
        <RefreshCw className="w-8 h-8 text-[#7c5cff] animate-spin" />
        <span className="text-xs font-mono">Loading persisted investigation details...</span>
      </div>
    );
  }

  if (error || !investigation) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 gap-4 bg-[#0c0d10]">
        <div className="p-4 bg-[#fb7185]/10 border border-[#fb7185]/30 rounded-xl text-center max-w-md">
          <AlertCircle className="w-8 h-8 text-[#fb7185] mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-[#f5f7fa] mb-1">Unable to Load Investigation</h3>
          <p className="text-xs text-[#fb7185] mb-4">{error || 'Investigation could not be retrieved.'}</p>
          <div className="flex justify-center gap-2">
            <Button variant="secondary" size="sm" onClick={onBack}>
              Back to History
            </Button>
            <Button variant="primary" size="sm" onClick={loadDetail}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const messages = Array.isArray(investigation.messages) ? investigation.messages : [];
  const evidenceList = Array.isArray(investigation.evidence) ? investigation.evidence : [];

  return (
    <div className="flex flex-col h-full bg-[#0c0d10] text-[#f5f7fa] overflow-hidden rounded-xl border border-[#1b1e24] animate-fadeIn">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#1b1e24] bg-[#131519] flex-shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="text-xs text-[#a5adbb] hover:text-[#f5f7fa] flex items-center gap-1 font-mono cursor-pointer"
          >
            ← History Archive
          </button>
          <span className="text-[#24272f]">|</span>
          <span className="font-mono text-xs font-semibold text-[#8a74ff] bg-[#191c22] border border-[#24272f] px-2 py-0.5 rounded flex items-center gap-1">
            <Hash className="w-3 h-3" />
            {investigation.id.slice(0, 8)}
          </span>
          <h2 className="text-sm font-semibold text-[#f5f7fa] truncate max-w-xs sm:max-w-md">
            {investigation.title || 'Untitled Case'}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Badge */}
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-medium border ${
              investigation.status === 'completed'
                ? 'bg-[#10b981]/15 text-[#34d399] border-[#10b981]/30'
                : 'bg-[#3b82f6]/15 text-[#60a5fa] border-[#3b82f6]/30'
            }`}
          >
            {investigation.status === 'completed' ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : (
              <CircleDot className="w-3 h-3 animate-pulse text-[#3b82f6]" />
            )}
            <span className="capitalize">{investigation.status || 'Active'}</span>
          </span>

          {/* Status toggle button */}
          <button
            onClick={handleStatusToggle}
            className="text-xs font-mono text-[#a5adbb] hover:text-[#f5f7fa] bg-[#191c22] hover:bg-[#20242c] border border-[#24272f] px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
          >
            {investigation.status === 'completed' ? 'Reopen' : 'Mark Completed'}
          </button>

          {/* Continue Action */}
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Play className="w-3.5 h-3.5" />}
            onClick={() => onContinueInvestigation(investigation.id)}
          >
            Continue in Console
          </Button>

          {/* Export Report Dropdown */}
          <div className="relative group">
            <Button
              variant="secondary"
              size="sm"
              isLoading={isExporting}
              leftIcon={<Download className="w-3.5 h-3.5" />}
            >
              Export
            </Button>
            <div className="absolute right-0 top-full mt-1 hidden group-hover:flex flex-col bg-[#191c22] border border-[#24272f] rounded-lg shadow-xl p-1 z-20 w-40 text-xs">
              <button
                onClick={() => handleExport('markdown')}
                className="px-3 py-1.5 text-left text-[#a5adbb] hover:text-[#f5f7fa] hover:bg-[#20242c] rounded cursor-pointer"
              >
                Markdown (.md)
              </button>
              <button
                onClick={() => handleExport('json')}
                className="px-3 py-1.5 text-left text-[#a5adbb] hover:text-[#f5f7fa] hover:bg-[#20242c] rounded cursor-pointer"
              >
                JSON Telemetry
              </button>
              <button
                onClick={handleCopyReport}
                className="px-3 py-1.5 text-left text-[#a5adbb] hover:text-[#f5f7fa] hover:bg-[#20242c] rounded cursor-pointer"
              >
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Investigation Metadata & Evidence Overview */}
        <div className="w-72 border-r border-[#1b1e24] bg-[#111317] p-4 flex flex-col gap-4 overflow-y-auto hidden lg:flex flex-shrink-0">
          <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#6c7280]">
            Case Telemetry
          </div>

          <div className="p-3 bg-[#16181e] border border-[#222630] rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between text-[#a5adbb]">
              <span>Created</span>
              <span className="font-mono text-[#f5f7fa]">
                {new Date(investigation.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="flex items-center justify-between text-[#a5adbb]">
              <span>Messages</span>
              <span className="font-mono text-[#f5f7fa]">{messages.length}</span>
            </div>
            <div className="flex items-center justify-between text-[#a5adbb]">
              <span>Evidence Records</span>
              <span className="font-mono text-[#f5f7fa]">{evidenceList.length}</span>
            </div>
          </div>

          {/* Quick Continue Prompt */}
          <div className="p-3 bg-[#7c5cff]/10 border border-[#7c5cff]/20 rounded-xl space-y-2">
            <div className="text-xs font-semibold text-[#a18dff] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Resume Investigation</span>
            </div>
            <p className="text-[11px] text-[#cbd5e1] leading-relaxed">
              Continue right where you left off. The AI orchestrator will load this persisted PostgreSQL thread into memory.
            </p>
            <button
              onClick={() => onContinueInvestigation(investigation.id)}
              className="w-full flex items-center justify-center gap-1.5 bg-[#7c5cff] hover:bg-[#8f6dff] text-white text-xs font-medium py-2 rounded-lg transition-colors shadow-md cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Launch Live Console</span>
            </button>
          </div>
        </div>

        {/* Right Side: Conversation Stream with Phase 4C Diagnostic Rendering */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0c0d10] overflow-y-auto p-4 md:p-8">
          <div className="max-w-4xl mx-auto w-full space-y-5">
            {messages.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#6c7280]">
                No messages recorded for this investigation yet.
              </div>
            ) : (
              messages.map((m: any) => (
                <MessageBubble
                  key={m.id || crypto.randomUUID()}
                  role={m.role}
                  content={m.content}
                  metadata={m.metadata || null}
                  timestamp={m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                />
              ))
            )}

            {/* Bottom Continue Action Banner */}
            <div className="mt-8 pt-6 border-t border-[#1b1e24] flex items-center justify-between bg-[#131519] border border-[#1f232b] p-4 rounded-xl flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#7c5cff]/20 flex items-center justify-center text-[#8a74ff]">
                  <Play className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-[#f5f7fa]">Follow-up on this Investigation</h4>
                  <p className="text-[11px] text-[#a5adbb]">
                    Ask further questions or inspect additional files in the Live Console.
                  </p>
                </div>
              </div>

              <Button
                variant="primary"
                size="md"
                leftIcon={<Play className="w-4 h-4" />}
                onClick={() => onContinueInvestigation(investigation.id)}
              >
                Continue in Live Console
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
