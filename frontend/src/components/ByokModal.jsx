import React, { useState, useEffect } from 'react';
import { KeyRound, ShieldCheck, X, Trash2, CheckCircle2, Lock } from 'lucide-react';

const PROVIDERS = [
  { id: 'groq', name: 'Groq (LPU Inference)' },
  { id: 'gemini', name: 'Google Gemini' },
  { id: 'openai', name: 'OpenAI' },
  { id: 'openrouter', name: 'OpenRouter' },
  { id: 'deepseek', name: 'DeepSeek' },
  { id: 'cerebras', name: 'Cerebras' }
];

export default function ByokModal({ isOpen, onClose, onSave, onClear }) {
  const [selectedProvider, setSelectedProvider] = useState('groq');
  const [apiKey, setApiKey] = useState('');
  const [savedKeys, setSavedKeys] = useState({});

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('byok_keys');
      if (stored) {
        setSavedKeys(JSON.parse(stored));
      }
    } catch (e) {}
  }, [isOpen]);

  useEffect(() => {
    setApiKey(savedKeys[selectedProvider] || '');
  }, [selectedProvider, savedKeys]);

  if (!isOpen) return null;

  const handleSave = () => {
    const updated = { ...savedKeys };
    if (apiKey.trim()) {
      updated[selectedProvider] = apiKey.trim();
    } else {
      delete updated[selectedProvider];
    }
    try {
      sessionStorage.setItem('byok_keys', JSON.stringify(updated));
    } catch (e) {}
    setSavedKeys(updated);
    if (onSave) onSave(updated);
    onClose();
  };

  const handleClearAll = () => {
    try {
      sessionStorage.removeItem('byok_keys');
    } catch (e) {}
    setSavedKeys({});
    setApiKey('');
    if (onClear) onClear();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="w-full max-w-md rounded-2xl bg-[#131519] border border-[#24272f] p-6 shadow-2xl text-[#f5f7fa] flex flex-col gap-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#1b1e24] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#7c5cff]/10 border border-[#7c5cff]/20 flex items-center justify-center text-[#a18dff]">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#f5f7fa]">API Key Settings (BYOK)</h2>
              <span className="text-[10px] font-mono text-[#6c7280]">Session Credential Hub</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#6c7280] hover:bg-[#191c22] hover:text-[#f5f7fa] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Security Trust Notice */}
        <div className="rounded-xl border border-[#7c5cff]/20 bg-[#7c5cff]/8 p-3 text-xs text-[#a5adbb] flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[#8a74ff] flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Your API key is used strictly for your current session requests and is never stored, logged, or saved on our servers.
          </p>
        </div>

        {/* Provider and Input Selection */}
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[#6c7280] mb-1.5 font-medium">
              Select Provider
            </label>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="w-full rounded-xl border border-[#24272f] bg-[#191c22] px-3.5 py-2.5 text-xs text-[#f5f7fa] focus:border-[#7c5cff] focus:outline-none"
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#131519] text-[#f5f7fa]">
                  {p.name} {savedKeys[p.id] ? '(Key Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[#6c7280] mb-1.5 font-medium">
              API Key for {PROVIDERS.find((p) => p.id === selectedProvider)?.name}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste provider API key here..."
              className="w-full rounded-xl border border-[#24272f] bg-[#0f1115] px-3.5 py-2.5 text-xs text-[#f5f7fa] font-mono placeholder-[#6c7280] focus:border-[#7c5cff] focus:outline-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-[#1b1e24]">
          <button
            type="button"
            onClick={handleClearAll}
            className="flex items-center gap-1.5 text-xs font-medium text-[#fb7185] hover:text-red-400 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All Keys</span>
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#24272f] bg-[#191c22] px-4 py-2 text-xs font-semibold text-[#a5adbb] hover:bg-[#20242c] hover:text-[#f5f7fa] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-xl bg-[#7c5cff] hover:bg-[#8f6dff] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-[#7c5cff]/20 transition-all cursor-pointer"
            >
              Save Key
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
