import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Pin, Archive, Trash2, Edit3, Filter, Tag, CheckCircle2, Clock,
  ChevronRight, ExternalLink, Grid, List, Sparkles, Plus, Play, RefreshCw, AlertCircle, Hash, Database
} from 'lucide-react';
import { Button, Input, Card, Badge, ConfirmationDialog, Modal, useToast } from '../common';
import { fetchUserInvestigations, updateInvestigationStatusApi } from '../../services/chatService.js';

export interface HistoryPageProps {
  onSelectInvestigation: (id: string) => void;
  onContinueInvestigation: (id: string) => void;
  onNewInvestigation: () => void;
}

export const InvestigationHistoryPage: React.FC<HistoryPageProps> = ({
  onSelectInvestigation,
  onContinueInvestigation,
  onNewInvestigation,
}) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const { addToast } = useToast();

  const loadInvestigations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUserInvestigations();
      const list = Array.isArray(data.investigations) ? data.investigations : [];
      setItems(list);
    } catch (err: any) {
      console.error('[History] Failed to load investigations:', err);
      setError(err?.message || 'Failed to load investigation history. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvestigations();
  }, [loadInvestigations]);

  const handleStatusChange = async (id: string, nextStatus: 'active' | 'completed' | 'archived', e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateInvestigationStatusApi(id, nextStatus);
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: nextStatus } : item))
      );
      addToast({
        type: 'success',
        title: `Investigation Marked as ${nextStatus.toUpperCase()}`
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Status Update Failed',
        description: err?.message || 'Could not update status'
      });
    }
  };

  const filtered = items.filter((inv) => {
    const titleMatch = (inv.title || '').toLowerCase().includes(search.toLowerCase());
    const idMatch = (inv.id || '').toLowerCase().includes(search.toLowerCase());
    const matchesSearch = titleMatch || idMatch;

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : inv.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex flex-col w-full max-w-6xl mx-auto p-6 md:p-8 gap-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1b1e24] pb-6">
        <div>
          <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#a18dff] mb-1">
            Telemetry & Diagnostic Archive
          </div>
          <h1 className="text-2xl font-bold text-[#f5f7fa]">Investigation History</h1>
          <p className="text-xs text-[#a5adbb] mt-1">
            Browse, search, and continue persisted backend diagnostic cases and evidence traces.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="md"
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            onClick={loadInvestigations}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={onNewInvestigation}
          >
            New Investigation
          </Button>
        </div>
      </div>

      {/* Filter & View Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-[#191c22] border border-[#24272f] p-4 rounded-xl">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Search by ID or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Status filter tabs */}
          <div className="flex items-center bg-[#0f1115] border border-[#24272f] rounded-lg p-1 text-xs">
            {['all', 'active', 'completed', 'archived'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-2.5 py-1 rounded-md capitalize font-medium transition-all cursor-pointer ${
                  statusFilter === status
                    ? 'bg-[#7c5cff] text-white'
                    : 'text-[#6c7280] hover:text-[#f5f7fa]'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-[#0f1115] border border-[#24272f] rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md cursor-pointer ${viewMode === 'list' ? 'bg-[#20242c] text-[#f5f7fa]' : 'text-[#6c7280]'}`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md cursor-pointer ${viewMode === 'grid' ? 'bg-[#20242c] text-[#f5f7fa]' : 'text-[#6c7280]'}`}
              title="Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center p-16 gap-3 border border-[#1b1e24] rounded-xl bg-[#111317]">
          <RefreshCw className="w-6 h-6 text-[#7c5cff] animate-spin" />
          <span className="text-xs font-mono text-[#a5adbb]">Loading investigations from database...</span>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="p-5 bg-[#fb7185]/10 border border-[#fb7185]/30 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs text-[#fb7185]">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={loadInvestigations}>
            Try Again
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && items.length === 0 && (
        <div className="p-16 flex flex-col items-center justify-center text-center border border-dashed border-[#24272f] rounded-xl bg-[#111317]/50 gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#7c5cff]/10 border border-[#7c5cff]/20 flex items-center justify-center text-[#8a74ff]">
            <Database className="w-6 h-6" />
          </div>
          <div className="flex flex-col gap-1 max-w-sm">
            <h3 className="text-sm font-semibold text-[#f5f7fa]">No investigations recorded yet</h3>
            <p className="text-xs text-[#a5adbb]">
              All diagnostic sessions and investigations conducted in the Live Console will be automatically archived here.
            </p>
          </div>
          <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={onNewInvestigation}>
            Start First Investigation
          </Button>
        </div>
      )}

      {/* No matching search results */}
      {!loading && !error && items.length > 0 && filtered.length === 0 && (
        <div className="p-12 text-center border border-dashed border-[#24272f] rounded-xl text-xs text-[#6c7280]">
          No matching investigations found matching "{search}".
        </div>
      )}

      {/* Content View: List vs Grid */}
      {!loading && !error && filtered.length > 0 && (
        viewMode === 'list' ? (
          <div className="flex flex-col gap-3">
            {filtered.map((inv) => (
              <div
                key={inv.id}
                onClick={() => onSelectInvestigation(inv.id)}
                className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#14161b] border border-[#1f232b] hover:border-[#7c5cff]/50 hover:bg-[#191c23] p-4 rounded-xl transition-all cursor-pointer group shadow-sm"
              >
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-[#7c5cff] mt-2 flex-shrink-0" />
                  <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-[#8a74ff] bg-[#191c22] border border-[#24272f] px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                        <Hash className="w-2.5 h-2.5" />
                        {inv.id.slice(0, 8)}
                      </span>
                      <Badge
                        variant={
                          inv.status === 'completed'
                            ? 'emerald'
                            : inv.status === 'active'
                            ? 'blue'
                            : 'muted'
                        }
                        label={inv.status || 'active'}
                        size="sm"
                      />
                    </div>
                    <h3 className="text-sm font-semibold text-[#f5f7fa] group-hover:text-[#8a74ff] transition-colors truncate">
                      {inv.title || 'Untitled Investigation'}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-[#6c7280] font-mono mt-0.5">
                      <span>{inv.message_count || 0} messages</span>
                      <span>•</span>
                      <span>Created {new Date(inv.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      {inv.updated_at && (
                        <>
                          <span>•</span>
                          <span>Active {new Date(inv.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end md:self-center" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onContinueInvestigation(inv.id)}
                    className="flex items-center gap-1.5 bg-[#7c5cff] hover:bg-[#8f6dff] text-white text-xs px-3 py-1.5 rounded-lg transition-colors font-medium shadow-sm cursor-pointer"
                    title="Continue this investigation in Live Console"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Continue</span>
                  </button>

                  <button
                    onClick={(e) => handleStatusChange(inv.id, inv.status === 'completed' ? 'active' : 'completed', e)}
                    className="p-1.5 text-[#6c7280] hover:text-[#f5f7fa] hover:bg-[#1f232b] rounded-md transition-colors text-xs font-mono border border-[#24272f]"
                    title="Toggle Status"
                  >
                    {inv.status === 'completed' ? 'Reopen' : 'Complete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((inv) => (
              <Card
                key={inv.id}
                onClick={() => onSelectInvestigation(inv.id)}
                className="flex flex-col justify-between gap-4 cursor-pointer hover:border-[#7c5cff]/50 bg-[#14161b] transition-all"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-[#8a74ff] bg-[#191c22] border border-[#24272f] px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                      <Hash className="w-2.5 h-2.5" />
                      {inv.id.slice(0, 8)}
                    </span>
                    <Badge
                      variant={
                        inv.status === 'completed'
                          ? 'emerald'
                          : inv.status === 'active'
                          ? 'blue'
                          : 'muted'
                      }
                      label={inv.status || 'active'}
                      size="sm"
                    />
                  </div>
                  <h3 className="text-sm font-semibold text-[#f5f7fa] line-clamp-2">{inv.title || 'Untitled Investigation'}</h3>
                </div>

                <div className="flex flex-col gap-3 pt-3 border-t border-[#1f232b]">
                  <div className="flex items-center justify-between text-[11px] text-[#6c7280] font-mono">
                    <span>{inv.message_count || 0} messages</span>
                    <span>{new Date(inv.created_at).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onContinueInvestigation(inv.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-[#7c5cff] hover:bg-[#8f6dff] text-white text-xs py-1.5 px-3 rounded-lg transition-colors font-medium cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Continue</span>
                    </button>
                    <button
                      onClick={(e) => handleStatusChange(inv.id, inv.status === 'completed' ? 'active' : 'completed', e)}
                      className="px-2.5 py-1.5 text-[11px] text-[#a5adbb] hover:text-[#f5f7fa] bg-[#191c22] hover:bg-[#20242c] border border-[#24272f] rounded-lg transition-colors cursor-pointer font-mono"
                    >
                      {inv.status === 'completed' ? 'Reopen' : 'Resolve'}
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
};
