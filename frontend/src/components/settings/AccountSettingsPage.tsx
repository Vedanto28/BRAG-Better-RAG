import React, { useState } from 'react';
import {
  User, KeyRound, Shield, Gauge, Settings, ShieldAlert, Cpu, Keyboard,
  Sparkles, CheckCircle2, Lock, Trash2, Sliders, Eye, RefreshCw, Upload, Download, LogOut
} from 'lucide-react';
import { Button, Input, Select, Card, Badge, ConfirmationDialog, useToast } from '../common';
import { mockUserProfile, mockConnectedProviders, mockUsageMetrics } from '../../mockData';

import { useSession, signOut } from '../../lib/authClient';

export interface SettingsPageProps {
  onNavigateByok: () => void;
  onLogout?: () => void;
}

export const AccountSettingsPage: React.FC<SettingsPageProps> = ({ onNavigateByok, onLogout }) => {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<'account' | 'usage' | 'general' | 'models' | 'shortcuts' | 'danger'>('account');
  const [user, setUser] = useState({
    ...mockUserProfile,
    name: session?.user?.name || mockUserProfile.name,
    email: session?.user?.email || mockUserProfile.email
  });
  const [metrics] = useState(mockUsageMetrics);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const { addToast } = useToast();

  // Form states
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [defaultModel, setDefaultModel] = useState('openrouter');
  const [maxBudget, setMaxBudget] = useState(6);
  const [enableGuidance, setEnableGuidance] = useState(true);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setUser((prev) => ({ ...prev, name, email, role: role as any }));
    addToast({ type: 'success', title: 'Profile Updated', description: 'Your account settings have been persisted.' });
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    addToast({ type: 'success', title: 'Preferences Saved', description: 'Agent investigation defaults updated.' });
  };

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto p-6 md:p-8 gap-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1b1e24] pb-6">
        <div>
          <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#a18dff] mb-1">
            System Preferences & Credentials
          </div>
          <h1 className="text-2xl font-bold text-[#f5f7fa]">Account & Settings</h1>
          <p className="text-xs text-[#a5adbb] mt-1">
            Manage your developer profile, subscription quotas, BYOK providers, and agent defaults.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="tactile" size="sm" leftIcon={<KeyRound className="w-3.5 h-3.5" />} onClick={onNavigateByok}>
            Manage BYOK Keys
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#1b1e24] gap-6 overflow-x-auto pb-px">
        {[
          { id: 'account', label: 'Profile & Security', icon: User },
          { id: 'usage', label: 'Usage & Quota', icon: Gauge },
          { id: 'general', label: 'Agent Defaults', icon: Sliders },
          { id: 'models', label: 'Models & Privacy', icon: Cpu },
          { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
          { id: 'danger', label: 'Danger Zone', icon: ShieldAlert },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 pb-3 font-medium text-xs border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'border-[#7c5cff] text-[#f5f7fa]'
                  : 'border-transparent text-[#6c7280] hover:text-[#a5adbb]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#8a74ff]' : 'text-[#6c7280]'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      {activeTab === 'account' && (
        <form onSubmit={handleSaveProfile} className="flex flex-col gap-6 max-w-2xl">
          <Card hoverable={false} className="flex flex-col gap-6">
            <h3 className="text-sm font-semibold text-[#f5f7fa] border-b border-[#1b1e24] pb-3">
              Developer Profile
            </h3>
            <div className="flex items-center gap-5">
              <div className="relative">
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-16 h-16 rounded-full border-2 border-[#7c5cff]/40 object-cover"
                />
                <button
                  type="button"
                  className="absolute bottom-0 right-0 bg-[#20242c] border border-[#24272f] text-[#f5f7fa] p-1 rounded-full text-xs hover:bg-[#7c5cff] transition-colors"
                >
                  <Upload className="w-3 h-3" />
                </button>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#f5f7fa]">{user.name}</span>
                  <Badge variant="violet" label={user.role} size="sm" />
                </div>
                <span className="text-xs text-[#6c7280]">GitHub connected as @{user.githubHandle}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input label="Work Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Select
                label="Engineering Role"
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                options={[
                  { label: 'Tech Lead', value: 'Tech Lead' },
                  { label: 'Engineer', value: 'Engineer' },
                  { label: 'DevOps', value: 'DevOps' },
                  { label: 'Admin', value: 'Admin' },
                ]}
              />
              <Input label="GitHub Handle" value={user.githubHandle} disabled helperText="Managed via OAuth link" />
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="primary" size="sm" type="submit">
                Save Changes
              </Button>
            </div>
          </Card>
        </form>
      )}

      {activeTab === 'usage' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card hoverable={false} className="flex flex-col gap-2">
              <span className="text-xs text-[#6c7280] font-mono">CURRENT TIER</span>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-[#f5f7fa]">{metrics.currentTier}</span>
                <Badge variant="emerald" label="Active" />
              </div>
              <span className="text-[11px] text-[#6c7280] mt-1">Renews on {metrics.renewsAt}</span>
            </Card>

            <Card hoverable={false} className="flex flex-col gap-2">
              <span className="text-xs text-[#6c7280] font-mono">INVESTIGATIONS THIS MONTH</span>
              <div className="text-xl font-bold text-[#f5f7fa]">
                {metrics.investigationsThisMonth} <span className="text-xs text-[#6c7280] font-normal">/ {metrics.monthlyQuota}</span>
              </div>
              <div className="w-full bg-[#131519] rounded-full h-1.5 overflow-hidden mt-1">
                <div
                  className="bg-[#7c5cff] h-full rounded-full"
                  style={{ width: `${(metrics.investigationsThisMonth / metrics.monthlyQuota) * 100}%` }}
                />
              </div>
            </Card>

            <Card hoverable={false} className="flex flex-col gap-2">
              <span className="text-xs text-[#6c7280] font-mono">TOKENS CONSUMED</span>
              <div className="text-xl font-bold text-[#f5f7fa]">
                {(metrics.tokensConsumed / 1000000).toFixed(2)}M <span className="text-xs text-[#6c7280] font-normal">/ {(metrics.tokenQuota / 1000000).toFixed(0)}M</span>
              </div>
              <div className="w-full bg-[#131519] rounded-full h-1.5 overflow-hidden mt-1">
                <div
                  className="bg-[#3b82f6] h-full rounded-full"
                  style={{ width: `${(metrics.tokensConsumed / metrics.tokenQuota) * 100}%` }}
                />
              </div>
            </Card>
          </div>

          <Card hoverable={false} className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-[#f5f7fa]">Active BYOK Credentials & Quota Contribution</h3>
            <div className="divide-y divide-[#1b1e24]">
              {mockConnectedProviders.map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#0f1115] border border-[#24272f] flex items-center justify-center text-xs font-mono text-[#8a74ff]">
                      {p.providerId.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#f5f7fa]">{p.name}</div>
                      <div className="text-[11px] text-[#6c7280]">{p.isByok ? 'User Session Key (BYOK)' : 'Server Shared Key'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span className="text-[#a5adbb]">{p.quotaUsed ? `${p.quotaUsed.toLocaleString()} tokens` : 'Unlimited'}</span>
                    <Badge variant={p.status === 'connected' ? 'emerald' : 'muted'} label={p.status} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'general' && (
        <form onSubmit={handleSavePreferences} className="flex flex-col gap-6 max-w-2xl">
          <Card hoverable={false} className="flex flex-col gap-6">
            <h3 className="text-sm font-semibold text-[#f5f7fa] border-b border-[#1b1e24] pb-3">
              Agent Orchestrator Defaults
            </h3>
            <div className="flex flex-col gap-4">
              <Select
                label="Preferred Provider Selection Order"
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
                options={[
                  { label: 'OpenRouter (BYOK Auto-fallback)', value: 'openrouter' },
                  { label: 'Google Gemini 1.5 Pro', value: 'gemini' },
                  { label: 'OpenAI GPT-4o', value: 'openai' },
                  { label: 'Groq Llama 3 70B (Low Latency)', value: 'groq' },
                ]}
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#a5adbb]">
                  Shared Tool Call Budget Cap: <span className="font-mono text-[#8a74ff]">{maxBudget} calls</span>
                </label>
                <input
                  type="range"
                  min="2"
                  max="12"
                  value={maxBudget}
                  onChange={(e) => setMaxBudget(Number(e.target.value))}
                  className="w-full accent-[#7c5cff] cursor-pointer"
                />
                <span className="text-[11px] text-[#6c7280]">
                  Controls the maximum number of multi-provider MCP tool invocations per turn.
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-t border-[#1b1e24]">
                <div>
                  <div className="text-xs font-semibold text-[#f5f7fa]">Enable Execution Guidance Layer</div>
                  <div className="text-[11px] text-[#6c7280]">Pass deterministic priority hints to LLM loop</div>
                </div>
                <input
                  type="checkbox"
                  checked={enableGuidance}
                  onChange={(e) => setEnableGuidance(e.target.checked)}
                  className="w-4 h-4 accent-[#7c5cff] cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="primary" size="sm" type="submit">
                Save Preferences
              </Button>
            </div>
          </Card>
        </form>
      )}

      {activeTab === 'shortcuts' && (
        <Card hoverable={false} className="flex flex-col gap-4 max-w-2xl">
          <h3 className="text-sm font-semibold text-[#f5f7fa] border-b border-[#1b1e24] pb-3">
            Keyboard Shortcuts Cheatsheet
          </h3>
          <div className="divide-y divide-[#1b1e24] text-xs">
            {[
              { label: 'Open Command Palette', shortcut: ['Cmd', 'K'] },
              { label: 'Start New Investigation', shortcut: ['Cmd', 'N'] },
              { label: 'View Investigation History', shortcut: ['Cmd', 'H'] },
              { label: 'Manage BYOK Keys Modal', shortcut: ['Cmd', 'B'] },
              { label: 'Close Dialogs / Overlay', shortcut: ['Esc'] },
            ].map((sc, i) => (
              <div key={i} className="py-2.5 flex items-center justify-between">
                <span className="text-[#a5adbb] font-medium">{sc.label}</span>
                <div className="flex items-center gap-1 font-mono text-[11px]">
                  {sc.shortcut.map((k) => (
                    <kbd key={k} className="px-2 py-0.5 bg-[#0f1115] border border-[#24272f] rounded text-[#f5f7fa]">
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === 'danger' && (
        <Card hoverable={false} className="flex flex-col gap-6 border-[#fb7185]/30 bg-[#fb7185]/5 max-w-2xl">
          <div>
            <h3 className="text-sm font-semibold text-[#fb7185]">Danger Zone</h3>
            <p className="text-xs text-[#6c7280] mt-1">Irreversible security and data operations.</p>
          </div>

            <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between py-3 border-t border-[#fb7185]/20">
              <div>
                <div className="text-xs font-semibold text-[#f5f7fa]">Revoke All Active Sessions</div>
                <div className="text-[11px] text-[#6c7280]">Invalidate all active session tokens on server</div>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={async () => {
                  try {
                    await signOut();
                    addToast({ type: 'warning', title: 'Sessions Revoked', description: 'All active sessions invalidated on server.' });
                    if (onLogout) onLogout();
                  } catch (e) {
                    addToast({ type: 'error', title: 'Error', description: 'Failed to revoke sessions.' });
                  }
                }}
              >
                Revoke Sessions
              </Button>
            </div>

            <div className="flex items-center justify-between py-3 border-t border-[#fb7185]/20">
              <div>
                <div className="text-xs font-semibold text-[#fb7185]">Delete Developer Account</div>
                <div className="text-[11px] text-[#6c7280]">Permanently erase history and credentials</div>
              </div>
              <Button variant="danger" size="sm" onClick={() => setIsDeleteModalOpen(true)}>
                Delete Account
              </Button>
            </div>
          </div>
        </Card>
      )}

      <ConfirmationDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={() => addToast({ type: 'error', title: 'Account Deleted', description: 'Account erased.' })}
        title="Delete Account Permanently?"
        description="Are you sure you want to delete your account? All investigation histories, pinned evidence, and BYOK credentials will be permanently erased."
        confirmLabel="Permanently Delete"
        isDanger
      />
    </div>
  );
};
