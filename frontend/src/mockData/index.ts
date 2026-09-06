import {
  UserProfile,
  ConnectedProvider,
  UsageMetrics,
} from '../types';

export const mockUserProfile: UserProfile = {
  id: 'usr_mech_8892',
  name: 'Vedant Sharma',
  email: 'vedant@mechamaru.ai',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  role: 'Tech Lead',
  githubHandle: 'Vedanto28',
  joinedAt: '2026-01-15',
  twoFactorEnabled: true,
};

export const mockConnectedProviders: ConnectedProvider[] = [
  {
    id: 'prov_github_01',
    providerId: 'github',
    name: 'GitHub MCP Server',
    status: 'connected',
    lastUsedAt: '2 mins ago',
    isByok: false,
    maskedKey: 'ghp_****99999',
    quotaUsed: 1420,
  },
  {
    id: 'prov_openai_02',
    providerId: 'openai',
    name: 'OpenAI GPT-4o / O1',
    status: 'connected',
    lastUsedAt: '1 hour ago',
    isByok: true,
    maskedKey: 'sk-proj-****4921',
    quotaUsed: 89000,
  },
  {
    id: 'prov_gemini_03',
    providerId: 'gemini',
    name: 'Google Gemini 1.5 Pro',
    status: 'connected',
    lastUsedAt: 'Just now',
    isByok: false,
    maskedKey: 'AIzaSy****8821',
    quotaUsed: 31000,
  },
  {
    id: 'prov_anthropic_04',
    providerId: 'anthropic',
    name: 'Anthropic Claude 3.5 Sonnet',
    status: 'disconnected',
    lastUsedAt: '3 days ago',
    isByok: true,
    maskedKey: 'sk-ant-****1102',
  },
  {
    id: 'prov_groq_05',
    providerId: 'groq',
    name: 'Groq Llama-3-70B',
    status: 'connected',
    lastUsedAt: '4 hours ago',
    isByok: true,
    maskedKey: 'gsk_****7721',
    quotaUsed: 15400,
  },
];

export const mockUsageMetrics: UsageMetrics = {
  currentTier: 'Developer Pro',
  investigationsThisMonth: 148,
  monthlyQuota: 500,
  tokensConsumed: 1420500,
  tokenQuota: 5000000,
  activeSessionsCount: 3,
  mcpCallsCount: 892,
  renewsAt: '2026-08-15',
};

