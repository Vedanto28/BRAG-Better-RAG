import React, { useState } from 'react';
import {
  Search, Pin, Archive, Trash2, Edit3, Filter, Tag, CheckCircle2, Clock,
  ChevronRight, ExternalLink, Grid, List, Sparkles, Plus
} from 'lucide-react';
import { Button, Input, Card, Badge, ConfirmationDialog, Modal, useToast } from '../common';
import { mockInvestigations } from '../../mockData';
import { Investigation } from '../../types';

export interface HistoryPageProps {
  onSelectInvestigation: (id: string) => void;
  onNewInvestigation: () => void;
}

export const InvestigationHistoryPage: React.FC<HistoryPageProps> = ({
  onSelectInvestigation,
  onNewInvestigation,
}) => {
  const [items, setItems] = useState<Investigation[]>(mockInvestigations);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Modal states
  const [editingItem, setEditingItem] = useState<Investigation | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { addToast } = useToast();

  // All unique tags
  const allTags = Array.from(new Set(items.flatMap((i) => i.tags)));

  // Filtered list
  const filtered = items.filter((inv) => {
    const matchesSearch =
      inv.title.toLowerCase().includes(search.toLowerCase()) ||
      inv.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'pinned'
        ? inv.pinned
        : inv.status === statusFilter;
    const matchesTag = selectedTag ? inv.tags.includes(selectedTag) : true;
    return matchesSearch && matchesStatus && matchesTag;
  });

  const handleTogglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, pinned: !item.pinned } : item))
    );
    addToast({ type: 'info', title: 'Investigation Pinned State Updated' });
  };

  const handleToggleArchive = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, archived: !item.archived, status: item.archived ? 'completed' : 'archived' }
          : item
      )
    );
    addToast({ type: 'info', title: 'Investigation Archive Status Updated' });
  };

  const handleDeleteConfirm = () => {
    if (deletingId) {
      setItems((prev) => prev.filter((i) => i.id !== deletingId));
      addToast({ type: 'success', title: 'Investigation Deleted' });
      setDeletingId(null);
    }
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem && renameTitle.trim()) {
      setItems((prev) =>
        prev.map((i) => (i.id === editingItem.id ? { ...i, title: renameTitle.trim() } : i))
      );
      addToast({ type: 'success', title: 'Investigation Renamed' });
      setEditingItem(null);
    }
  };

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
            Browse, search, and export historical agentic diagnostic cases and evidence traces.
          </p>
        </div>
        <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />} onClick={onNewInvestigation}>
          New Investigation
        </Button>
      </div>

      {/* Filter & View Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-[#191c22] border border-[#24272f] p-4 rounded-xl">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Search by CASE-ID or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Status filter tabs */}
          <div className="flex items-center bg-[#0f1115] border border-[#24272f] rounded-lg p-1 text-xs">
            {['all', 'pinned', 'completed', 'active', 'archived'].map((status) => (
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
              className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-[#20242c] text-[#f5f7fa]' : 'text-[#6c7280]'}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md ${viewMode === 'grid' ? 'bg-[#20242c] text-[#f5f7fa]' : 'text-[#6c7280]'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tag filter pills */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-[#6c7280]">Filter by tag:</span>
          {selectedTag && (
            <button
              onClick={() => setSelectedTag(null)}
              className="text-[11px] font-mono text-[#fb7185] bg-[#fb7185]/10 border border-[#fb7185]/20 px-2 py-0.5 rounded-full"
            >
              Clear Tag filter
            </button>
          )}
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                selectedTag === tag
                  ? 'bg-[#7c5cff]/20 border-[#7c5cff] text-[#a18dff]'
                  : 'bg-[#191c22] border-[#24272f] text-[#a5adbb] hover:border-[#6c7280]'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Content View */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-[#24272f] rounded-xl text-xs text-[#6c7280]">
          No matching investigations found in archive.
        </div>
      ) : viewMode === 'list' ? (
        <div className="flex flex-col gap-3">
          {filtered.map((inv) => (
            <div
              key={inv.id}
              onClick={() => onSelectInvestigation(inv.id)}
              className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#191c22] border border-[#24272f] hover:border-[#7c5cff]/50 hover:bg-[#20242c] p-4 rounded-xl transition-all cursor-pointer group"
            >
              <div className="flex items-start gap-3.5 flex-1 min-w-0">
                <button
                  onClick={(e) => handleTogglePin(inv.id, e)}
                  className={`mt-1 transition-colors ${
                    inv.pinned ? 'text-[#fbbf24]' : 'text-[#6c7280] hover:text-[#f5f7fa]'
                  }`}
                >
                  <Pin className="w-4 h-4" />
                </button>
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-[#8a74ff] font-semibold">{inv.id}</span>
                    <Badge
                      variant={
                        inv.status === 'completed'
                          ? 'emerald'
                          : inv.status === 'active'
                          ? 'blue'
                          : 'muted'
                      }
                      label={inv.status}
                      size="sm"
                    />
                    <Badge variant="violet" label={`${inv.confidenceScore}% Confidence`} size="sm" />
                  </div>
                  <h3 className="text-sm font-semibold text-[#f5f7fa] group-hover:text-[#8a74ff] transition-colors truncate">
                    {inv.title}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-[#6c7280] font-mono mt-1">
                    <span>{inv.provider}</span>
                    <span>•</span>
                    <span>{inv.messageCount} messages</span>
                    <span>•</span>
                    <span>Updated {inv.updatedAt}</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 self-end md:self-center" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => {
                    setEditingItem(inv);
                    setRenameTitle(inv.title);
                  }}
                  className="p-1.5 text-[#6c7280] hover:text-[#f5f7fa] hover:bg-[#0f1115] rounded-md transition-colors"
                  title="Rename"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => handleToggleArchive(inv.id, e)}
                  className="p-1.5 text-[#6c7280] hover:text-[#f5f7fa] hover:bg-[#0f1115] rounded-md transition-colors"
                  title="Archive"
                >
                  <Archive className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeletingId(inv.id)}
                  className="p-1.5 text-[#6c7280] hover:text-[#fb7185] hover:bg-[#0f1115] rounded-md transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
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
              className="flex flex-col justify-between gap-4 cursor-pointer"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[#8a74ff]">{inv.id}</span>
                  <button onClick={(e) => handleTogglePin(inv.id, e)}>
                    <Pin className={`w-3.5 h-3.5 ${inv.pinned ? 'text-[#fbbf24]' : 'text-[#6c7280]'}`} />
                  </button>
                </div>
                <h3 className="text-sm font-semibold text-[#f5f7fa] line-clamp-2">{inv.title}</h3>
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-[#1b1e24]">
                <div className="flex items-center gap-2">
                  <Badge variant="emerald" label={`${inv.confidenceScore}% Score`} size="sm" />
                  <span className="text-[11px] text-[#6c7280] font-mono">{inv.provider}</span>
                </div>
                <span className="text-[11px] text-[#6c7280]">Updated {inv.updatedAt}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modals */}
      <Modal
        isOpen={!!editingItem}
        onClose={() => setEditingItem(null)}
        title="Rename Case Title"
      >
        <form onSubmit={handleRenameSubmit} className="flex flex-col gap-4">
          <Input
            label="Case Title"
            value={renameTitle}
            onChange={(e) => setRenameTitle(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setEditingItem(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Title
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmationDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Investigation Permanently?"
        description="Are you sure you want to delete this investigation? All gathered logs, commit traces, and report artifacts will be removed."
        confirmLabel="Delete Case"
        isDanger
      />
    </div>
  );
};
