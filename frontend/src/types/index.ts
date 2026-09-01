/**
 * BRAG Core Data Contracts & Interfaces
 */

export type InvestigationStatus = 'active' | 'completed' | 'failed' | 'queued' | 'archived';

export type InvestigationMode =
  | 'repository_investigation'
  | 'log_investigation'
  | 'change_investigation'
  | 'knowledge_debugging'
  | 'normal_chat';

export interface EvidenceItem {
  id: string;
  type: 'log' | 'code' | 'commit' | 'doc' | 'runtime';
  title: string;
  source: string;
  snippet?: string;
  lineRange?: string;
  timestamp: string;
}

export interface InvestigationStep {
  id: string;
  stage: 'Planning' | 'Repository Inspection' | 'Documentation Search' | 'Runtime Analysis' | 'Evidence Synthesis';
  status: 'pending' | 'running' | 'completed' | 'failed';
  label: string;
  durationMs?: number;
  details?: string;
}

export interface DiagnosticReport {
  hypothesis: string;
  confidence: number; // 0 - 100
  evidenceSummary: EvidenceItem[];
  assessment: string;
  nextSteps: string[];
}

export interface Investigation {
  id: string;
  title: string;
  status: InvestigationStatus;
  mode: InvestigationMode;
  confidenceScore: number;
  pinned: boolean;
  archived: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  provider: string;
  steps: InvestigationStep[];
  report?: DiagnosticReport;
  evidence: EvidenceItem[];
  messageCount: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: 'Engineer' | 'Tech Lead' | 'DevOps' | 'Admin';
  githubHandle?: string;
  joinedAt: string;
  twoFactorEnabled: boolean;
}

export interface ConnectedProvider {
  id: string;
  providerId: 'github' | 'openai' | 'anthropic' | 'gemini' | 'groq' | 'cerebras';
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  lastUsedAt?: string;
  isByok: boolean;
  maskedKey?: string;
  quotaUsed?: number;
}

export interface UsageMetrics {
  currentTier: 'Developer Pro' | 'Enterprise' | 'Free Guest';
  investigationsThisMonth: number;
  monthlyQuota: number;
  tokensConsumed: number;
  tokenQuota: number;
  activeSessionsCount: number;
  mcpCallsCount: number;
  renewsAt: string;
}

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  description?: string;
}

export interface CommandItem {
  id: string;
  label: string;
  category: 'Navigation' | 'Actions' | 'Investigations' | 'Settings';
  shortcut?: string[];
  iconName?: string;
  action: () => void;
}
