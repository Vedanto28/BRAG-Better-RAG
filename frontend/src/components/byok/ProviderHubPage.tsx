import React, { useState, useEffect } from 'react';
import {
  KeyRound, ShieldCheck, Zap, Sparkles, Star, Route, Waves, Asterisk,
  Check, Trash2, Loader2, Eye, EyeOff, ClipboardPaste, ArrowRight, CheckCircle2,
  Sliders, Plus, RefreshCw, X
} from 'lucide-react';
import { useToast } from '../common';

export interface ProviderHubPageProps {
  onNavigateWorkbench?: () => void;
}

interface ProviderMeta {
  id: string;
  name: string;
  desc: string;
  glyph: any;
  color: string;
  envKeyName: string;
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: 'groq',
    name: 'Groq',
    desc: 'LPU-accelerated inference (Llama 3.3 / compound models)',
    glyph: Zap,
    color: '#ff7a30',
    envKeyName: 'GROQ_API_KEY'
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    desc: 'Multimodal Gemini models (Flash / Pro)',
    glyph: Star,
    color: '#7a7bff',
    envKeyName: 'GEMINI_API_KEY'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    desc: 'GPT-4o and reasoning model family',
    glyph: Sparkles,
    color: '#12a37f',
    envKeyName: 'OPENAI_API_KEY'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    desc: 'Unified multi-model API gateway',
    glyph: Route,
    color: '#4f7fff',
    envKeyName: 'OPENROUTER_API_KEY'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    desc: 'Code generation & reasoning models',
    glyph: Waves,
    color: '#2dd4d4',
    envKeyName: 'DEEPSEEK_API_KEY'
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    desc: 'Ultra-fast wafer-scale inference',
    glyph: Sliders,
    color: '#fb7185',
    envKeyName: 'CEREBRAS_API_KEY'
  }
];

export const ProviderHubPage: React.FC<ProviderHubPageProps> = ({ onNavigateWorkbench }) => {
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [activeProvider, setActiveProvider] = useState<string>('groq');
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<'all' | 'active' | 'configured'>('all');
  const { addToast } = useToast();

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('byok_keys');
      if (stored) {
        const parsed = JSON.parse(stored);
        setKeys(parsed);
      }
      const storedActive = sessionStorage.getItem('active_byok_provider');
      if (storedActive) {
        setActiveProvider(storedActive);
      }
    } catch (e) {}
  }, []);

  const handleSaveKey = (providerId: string) => {
    const rawVal = inputValues[providerId]?.trim();
    if (!rawVal) return;

    if (rawVal.length < 10) {
      addToast({
        type: 'error',
        title: 'Invalid Key Format',
        description: 'API key must be at least 10 characters without spaces.'
      });
      return;
    }

    const updated = { ...keys, [providerId]: rawVal };
    setKeys(updated);
    setInputValues(prev => ({ ...prev, [providerId]: '' }));
    try {
      sessionStorage.setItem('byok_keys', JSON.stringify(updated));
    } catch (e) {}

    addToast({
      type: 'success',
      title: 'Key Configured',
      description: `${PROVIDERS.find(p => p.id === providerId)?.name} BYOK key saved for this session.`
    });
  };

  const handleRemoveKey = (providerId: string) => {
    const updated = { ...keys };
    delete updated[providerId];
    setKeys(updated);
    try {
      sessionStorage.setItem('byok_keys', JSON.stringify(updated));
    } catch (e) {}

    addToast({
      type: 'info',
      title: 'Key Removed',
      description: `${PROVIDERS.find(p => p.id === providerId)?.name} key cleared.`
    });
  };

  const handleSelectActive = (providerId: string) => {
    setActiveProvider(providerId);
    try {
      sessionStorage.setItem('active_byok_provider', providerId);
    } catch (e) {}
    addToast({
      type: 'success',
      title: 'Active Provider Changed',
      description: `Default routing prioritized for ${PROVIDERS.find(p => p.id === providerId)?.name}.`
    });
  };

  const filteredProviders = PROVIDERS.filter(p => {
    if (filter === 'configured') return !!keys[p.id];
    if (filter === 'active') return activeProvider === p.id;
    return true;
  });

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto p-6 md:p-8 gap-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1b1e24] pb-6">
        <div>
          <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#a18dff] mb-1 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-[#8a74ff]" />
            <span>Bring Your Own Key (BYOK) & Provider Hub</span>
          </div>
          <h1 className="text-2xl font-bold text-[#f5f7fa]">API Keys & Model Providers</h1>
          <p className="text-xs text-[#a5adbb] mt-1 max-w-2xl">
            Configure custom session credentials for LLM providers. Keys are stored strictly in your browser session memory and injected via encrypted request headers without server-side persistence.
          </p>
        </div>

        {onNavigateWorkbench && (
          <button
            onClick={onNavigateWorkbench}
            className="self-start md:self-auto inline-flex items-center gap-2 bg-[#7c5cff] hover:bg-[#8f6dff] active:scale-95 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
          >
            <span>Open Live Console</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Trust Notice */}
      <div className="flex items-start gap-3 bg-[#7c5cff]/8 border border-[#7c5cff]/20 rounded-xl p-4 text-xs text-[#a5adbb]">
        <ShieldCheck className="w-4 h-4 text-[#8a74ff] flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-[#f5f7fa]">Zero Server-Side Key Retention:</span>
          <p>
            Your API keys remain in browser <code className="text-[#a18dff] font-mono">sessionStorage</code> and are sent to the backend via ephemeral headers (<code className="text-[#a18dff] font-mono">x-byok-[provider]-key</code>) only during active requests.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-[#1b1e24] pb-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            filter === 'all' ? 'bg-[#191c22] text-[#f5f7fa] border border-[#24272f]' : 'text-[#6c7280] hover:text-[#a5adbb]'
          }`}
        >
          All Providers ({PROVIDERS.length})
        </button>
        <button
          onClick={() => setFilter('configured')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            filter === 'configured' ? 'bg-[#191c22] text-[#f5f7fa] border border-[#24272f]' : 'text-[#6c7280] hover:text-[#a5adbb]'
          }`}
        >
          Configured ({Object.keys(keys).length})
        </button>
      </div>

      {/* Provider Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredProviders.map((prov) => {
          const isConfigured = !!keys[prov.id];
          const isActive = activeProvider === prov.id;
          const Glyph = prov.glyph;

          return (
            <div
              key={prov.id}
              className={`flex flex-col gap-4 p-5 rounded-xl border bg-[#131519] transition-all ${
                isActive
                  ? 'border-[#7c5cff]/50 shadow-lg shadow-[#7c5cff]/10'
                  : 'border-[#1b1e24] hover:border-[#24272f]'
              }`}
            >
              {/* Card Top */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-md"
                    style={{ background: prov.color }}
                  >
                    <Glyph className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[#f5f7fa]">{prov.name}</span>
                      {isActive && (
                        <span className="text-[10px] font-mono bg-[#7c5cff]/20 text-[#a18dff] px-1.5 py-0.2 rounded border border-[#7c5cff]/30">
                          Primary
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#6c7280] mt-0.5">{prov.desc}</p>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                    isConfigured
                      ? 'bg-[#10b981]/10 text-[#34d399] border border-[#10b981]/20'
                      : 'bg-[#191c22] text-[#6c7280] border border-[#24272f]'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isConfigured ? 'bg-[#34d399]' : 'bg-[#6c7280]'
                    }`}
                  />
                  {isConfigured ? 'Key Active' : 'Unset'}
                </span>
              </div>

              {/* Key Input / Masked Display */}
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-wider text-[#6c7280] block">
                  Session API Key
                </label>

                {isConfigured ? (
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[#0f1115] border border-[#1b1e24] text-xs font-mono text-[#a5adbb]">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#34d399]" />
                      <span>••••••••••••••••••••••••</span>
                    </div>
                    <button
                      onClick={() => handleRemoveKey(prov.id)}
                      className="text-xs text-[#fb7185] hover:text-red-400 p-1 rounded hover:bg-[#fb7185]/10 transition-colors cursor-pointer"
                      title="Clear session key"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      value={inputValues[prov.id] || ''}
                      onChange={(e) =>
                        setInputValues((prev) => ({ ...prev, [prov.id]: e.target.value }))
                      }
                      placeholder={`Enter ${prov.name} API key...`}
                      className="flex-1 bg-[#0f1115] border border-[#24272f] focus:border-[#7c5cff] rounded-lg px-3 py-2 text-xs text-[#f5f7fa] placeholder-[#6c7280] font-mono outline-none"
                    />
                    <button
                      onClick={() => handleSaveKey(prov.id)}
                      disabled={!inputValues[prov.id]?.trim()}
                      className="bg-[#191c22] hover:bg-[#20242c] disabled:opacity-40 border border-[#24272f] text-[#f5f7fa] text-xs font-medium px-3 py-2 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-[#1b1e24] flex items-center justify-between text-xs">
                <span className="text-[11px] font-mono text-[#6c7280]">
                  Env: <code className="text-[#a5adbb]">{prov.envKeyName}</code>
                </span>

                {!isActive && (
                  <button
                    onClick={() => handleSelectActive(prov.id)}
                    className="text-[11px] text-[#8a74ff] hover:text-[#a18dff] font-medium cursor-pointer"
                  >
                    Set as Primary →
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
