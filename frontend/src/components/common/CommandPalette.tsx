import React, { useState, useEffect } from 'react';
import { Search, Terminal, Settings, ShieldCheck, FolderGit2, KeyRound, User, ArrowRight } from 'lucide-react';
import { CommandItem } from '../../types';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands: CommandItem[] = [
    {
      id: 'cmd-new',
      label: 'Start New Investigation',
      category: 'Actions',
      shortcut: ['Cmd', 'N'],
      action: () => onNavigate('investigation'),
    },
    {
      id: 'cmd-history',
      label: 'View Investigation History',
      category: 'Navigation',
      shortcut: ['Cmd', 'H'],
      action: () => onNavigate('history'),
    },
    {
      id: 'cmd-byok',
      label: 'Manage Connected Providers (BYOK)',
      category: 'Settings',
      shortcut: ['Cmd', 'K'],
      action: () => onNavigate('byok'),
    },
    {
      id: 'cmd-settings',
      label: 'General & Appearance Settings',
      category: 'Settings',
      action: () => onNavigate('settings'),
    },
    {
      id: 'cmd-account',
      label: 'Account Profile & Usage',
      category: 'Settings',
      action: () => onNavigate('account'),
    },
  ];

  const filteredCommands = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery('');
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-xl bg-[#191c22] border border-[#24272f] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center px-4 py-3 border-b border-[#1b1e24] gap-3">
          <Search className="w-4 h-4 text-[#6c7280]" />
          <input
            type="text"
            autoFocus
            placeholder="Type a command or search investigations..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="flex-1 bg-transparent text-sm text-[#f5f7fa] placeholder-[#6c7280] focus:outline-none font-sans"
          />
          <kbd className="px-2 py-0.5 text-[10px] font-mono text-[#6c7280] bg-[#0f1115] border border-[#24272f] rounded">
            ESC
          </kbd>
        </div>

        <div className="p-2 max-h-80 overflow-y-auto flex flex-col gap-1">
          {filteredCommands.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#6c7280]">No matching actions or commands found.</div>
          ) : (
            filteredCommands.map((cmd, idx) => (
              <button
                key={cmd.id}
                onClick={() => {
                  cmd.action();
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  selectedIndex === idx ? 'bg-[#7c5cff]/14 text-[#f5f7fa]' : 'text-[#a5adbb] hover:bg-[#20242c]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Terminal className="w-3.5 h-3.5 text-[#8a74ff]" />
                  <span className="font-medium">{cmd.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase text-[#6c7280] px-1.5 py-0.5 bg-[#0f1115] rounded">
                    {cmd.category}
                  </span>
                  {cmd.shortcut && (
                    <div className="flex items-center gap-1 font-mono text-[10px] text-[#6c7280]">
                      {cmd.shortcut.map((s) => (
                        <kbd key={s} className="px-1.5 py-0.5 bg-[#0f1115] border border-[#24272f] rounded">
                          {s}
                        </kbd>
                      ))}
                    </div>
                  )}
                  <ArrowRight className="w-3 h-3 text-[#6c7280]" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
