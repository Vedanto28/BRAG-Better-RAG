import React, { useState, useEffect } from 'react';
import ByokModal from './components/ByokModal.jsx';
import { ToastProvider, CommandPalette } from './components/common';
import { LandingPage } from './components/landing/LandingPage.tsx';
import { LoginPage } from './components/auth/AuthPages.tsx';
import { AccountSettingsPage } from './components/settings/AccountSettingsPage.tsx';
import { InvestigationHistoryPage } from './components/history/InvestigationHistoryPage.tsx';
import { InvestigationDetailPage } from './components/investigation/InvestigationDetailPage.tsx';
import { ProviderHubPage } from './components/byok/ProviderHubPage.tsx';
import { useChat } from './hooks/useChat.js';
import ChatHistory from './components/ChatHistory.jsx';
import ChatInput from './components/ChatInput.jsx';
import { 
  Terminal, 
  History, 
  Settings, 
  KeyRound, 
  User, 
  Plus, 
  ShieldCheck, 
  LogOut, 
  Sparkles, 
  Loader2,
  CheckCircle2,
  CircleDot,
  RotateCcw,
  Hash
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';

function MainApp() {
  const [currentView, setCurrentView] = useState('landing');
  const [selectedCaseId, setSelectedCaseId] = useState('CASE-2941-API-TIMEOUT');
  const [isByokOpen, setIsByokOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);

  const { user, session, profile, preferences, isLoading, isAuthenticated, logout, refetchSession } = useAuth();
  const { 
    investigationId,
    investigationMeta,
    history, 
    message, 
    setMessage, 
    loading, 
    isHydrating,
    error, 
    canSend, 
    sendMessage, 
    startNewInvestigation,
    loadInvestigation,
    setStatus,
    dismissError 
  } = useChat();

  // If user is on auth page and becomes authenticated, transition to workbench
  useEffect(() => {
    if (isAuthenticated && currentView === 'auth') {
      setCurrentView('workbench');
    }
  }, [isAuthenticated, currentView]);

  const handleLogout = async () => {
    startNewInvestigation();
    await logout();
    setCurrentView('landing');
  };

  const handleNewInvestigationClick = () => {
    startNewInvestigation();
    setCurrentView('workbench');
  };

  const handleStatusToggle = () => {
    if (!investigationId) return;
    const currentStatus = investigationMeta?.status || 'active';
    const nextStatus = currentStatus === 'active' ? 'completed' : 'active';
    setStatus(nextStatus);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a0b0d] text-[#f5f7fa] font-sans selection:bg-[#7c5cff]/20">
      {/* Command Palette Overlay */}
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        onNavigate={(view) => {
          if (view === 'byok') setCurrentView('byok');
          else setCurrentView(view);
        }}
      />

      {/* BYOK Modal Overlay */}
      <ByokModal isOpen={isByokOpen} onClose={() => setIsByokOpen(false)} />

      {/* LANDING VIEW */}
      {currentView === 'landing' && (
        <div className="w-full h-full overflow-y-auto">
          <LandingPage
            onStartGuest={() => setCurrentView('workbench')}
            onLogin={() => setCurrentView('auth')}
            onOpenByok={() => setCurrentView('byok')}
            user={user}
            isAuthenticated={isAuthenticated}
            isLoading={isLoading}
            onLogout={handleLogout}
            onNavigateWorkbench={() => setCurrentView('workbench')}
          />
        </div>
      )}

      {/* AUTH VIEW */}
      {currentView === 'auth' && (
        <div className="w-full h-full">
          <LoginPage
            onLoginSuccess={() => {
              refetchSession();
              setCurrentView('workbench');
            }}
            onNavigateGuest={() => setCurrentView('workbench')}
          />
        </div>
      )}

      {/* MAIN APP SHELL (WORKBENCH / DETAIL / HISTORY / SETTINGS / BYOK) */}
      {currentView !== 'landing' && currentView !== 'auth' && (
        <div className="flex w-full h-full overflow-hidden p-2 md:p-3 bg-[#0a0b0d]">
          {/* Sidebar Navigation */}
          <aside className="w-56 flex-shrink-0 bg-[#131519] border border-[#1b1e24] rounded-xl flex flex-col p-4 gap-4 hidden md:flex">
            {/* Logo */}
            <div
              onClick={() => setCurrentView('landing')}
              className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#7c5cff] to-[#8a74ff] flex items-center justify-center text-white font-bold text-xs shadow-md shadow-[#7c5cff]/30">
                M
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sm text-[#f5f7fa] tracking-tight">BRAG</span>
                <span className="text-[10px] text-[#6c7280]">Mechamaru RAG</span>
              </div>
            </div>

            {/* New Investigation Button */}
            <button
              onClick={handleNewInvestigationClick}
              className="flex items-center justify-center gap-2 bg-[#7c5cff] hover:bg-[#8f6dff] active:scale-[0.98] text-white font-medium py-2 px-3 rounded-lg text-xs transition-all shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Investigation</span>
            </button>

            {/* Navigation Links */}
            <nav className="flex flex-col gap-1 text-xs mt-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#6c7280] px-2 mb-1">
                Workspace
              </span>
              <button
                onClick={() => setCurrentView('workbench')}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                  currentView === 'workbench'
                    ? 'bg-[#7c5cff]/14 text-[#f5f7fa]'
                    : 'text-[#a5adbb] hover:bg-[#191c22] hover:text-[#f5f7fa]'
                }`}
              >
                <Terminal className="w-3.5 h-3.5 text-[#8a74ff]" />
                <span>Live Console</span>
              </button>
              <button
                onClick={() => setCurrentView('detail')}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                  currentView === 'detail'
                    ? 'bg-[#7c5cff]/14 text-[#f5f7fa]'
                    : 'text-[#a5adbb] hover:bg-[#191c22] hover:text-[#f5f7fa]'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#34d399]" />
                <span>Case Report</span>
              </button>
              <button
                onClick={() => setCurrentView('history')}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                  currentView === 'history'
                    ? 'bg-[#7c5cff]/14 text-[#f5f7fa]'
                    : 'text-[#a5adbb] hover:bg-[#191c22] hover:text-[#f5f7fa]'
                }`}
              >
                <History className="w-3.5 h-3.5 text-[#3b82f6]" />
                <span>History Archive</span>
              </button>
              <button
                onClick={() => setCurrentView('byok')}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                  currentView === 'byok'
                    ? 'bg-[#7c5cff]/14 text-[#f5f7fa]'
                    : 'text-[#a5adbb] hover:bg-[#191c22] hover:text-[#f5f7fa]'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5 text-[#fbbf24]" />
                <span>Provider Hub (BYOK)</span>
              </button>
            </nav>

            <nav className="flex flex-col gap-1 text-xs mt-auto border-t border-[#1b1e24] pt-3">
              <button
                onClick={() => setCurrentView('settings')}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                  currentView === 'settings'
                    ? 'bg-[#7c5cff]/14 text-[#f5f7fa]'
                    : 'text-[#a5adbb] hover:bg-[#191c22] hover:text-[#f5f7fa]'
                }`}
              >
                <Settings className="w-3.5 h-3.5 text-[#6c7280]" />
                <span>Settings</span>
              </button>
            </nav>
          </aside>

          {/* Main Application Area */}
          <main className="flex-1 flex flex-col min-w-0 bg-[#0c0d10] rounded-xl border border-[#1b1e24] ml-0 md:ml-2 overflow-hidden">
            {/* Top Bar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#1b1e24] bg-[#131519] flex-shrink-0">
              <div className="flex items-center gap-2 text-xs font-mono text-[#a5adbb]">
                <span className="text-[#8a74ff]">BRAG</span>
                <span>/</span>
                <span className="capitalize text-[#f5f7fa]">
                  {currentView === 'workbench' ? 'Live Console' : currentView === 'byok' ? 'Provider Hub' : currentView}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {isLoading ? (
                  <div className="w-24 h-6 bg-[#191c22] rounded-lg animate-pulse" />
                ) : isAuthenticated && user ? (
                  <div className="flex items-center gap-2 text-xs font-mono text-[#a5adbb] bg-[#191c22] border border-[#24272f] px-2.5 py-1 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-[#10b981]" />
                    <span className="truncate max-w-[160px]">{profile?.display_name || user.name || user.email}</span>
                  </div>
                ) : (
                  <button
                    onClick={() => setCurrentView('auth')}
                    className="text-xs text-[#8a74ff] hover:text-[#a18dff] font-medium px-2 py-1"
                  >
                    Log In
                  </button>
                )}

                <button
                  onClick={() => setIsCommandOpen(true)}
                  className="flex items-center gap-2 bg-[#191c22] border border-[#24272f] hover:border-[#6c7280] text-[#6c7280] text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <span>Search or command...</span>
                  <kbd className="px-1.5 py-0.5 bg-[#0f1115] text-[10px] font-mono rounded">Cmd+K</kbd>
                </button>

                {isAuthenticated && (
                  <button
                    onClick={handleLogout}
                    className="text-xs text-[#6c7280] hover:text-[#f5f7fa] p-1.5 cursor-pointer"
                    title="Sign Out / Exit"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* View Rendering */}
            <div className="flex-1 overflow-y-auto">
              {currentView === 'workbench' && (
                <div className="flex flex-col h-full">
                  {/* Persistent Investigation Header / Workspace Bar */}
                  <div className="px-5 py-2.5 bg-[#0e1014] border-b border-[#1b1e24] flex items-center justify-between flex-wrap gap-2 flex-shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-[#7c5cff]" />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-[#f5f7fa] truncate max-w-[280px] sm:max-w-md">
                            {investigationMeta?.title || (investigationId ? `Investigation ${investigationId.slice(0, 8)}` : 'New Diagnostic Investigation')}
                          </span>
                          {investigationId && (
                            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono bg-[#191c22] border border-[#24272f] text-[#6c7280] px-1.5 py-0.5 rounded">
                              <Hash className="w-2.5 h-2.5" />
                              {investigationId.slice(0, 8)}
                            </span>
                          )}
                        </div>
                        {isHydrating && (
                          <span className="text-[10px] font-mono text-[#8a74ff] flex items-center gap-1">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            Hydrating persisted investigation...
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Status Badge */}
                      {investigationId ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${
                              investigationMeta?.status === 'completed'
                                ? 'bg-[#10b981]/15 text-[#34d399] border-[#10b981]/30'
                                : 'bg-[#3b82f6]/15 text-[#60a5fa] border-[#3b82f6]/30'
                            }`}
                          >
                            {investigationMeta?.status === 'completed' ? (
                              <CheckCircle2 className="w-2.5 h-2.5" />
                            ) : (
                              <CircleDot className="w-2.5 h-2.5 animate-pulse text-[#3b82f6]" />
                            )}
                            <span className="capitalize">{investigationMeta?.status || 'Active'}</span>
                          </span>

                          <button
                            onClick={handleStatusToggle}
                            className="text-[10px] font-mono text-[#a5adbb] hover:text-[#f5f7fa] bg-[#191c22] hover:bg-[#20242c] border border-[#24272f] px-2 py-0.5 rounded transition-colors cursor-pointer"
                          >
                            {investigationMeta?.status === 'completed' ? 'Reopen' : 'Mark Completed'}
                          </button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-[#a5adbb] bg-[#191c22] border border-[#24272f]">
                          <CircleDot className="w-2.5 h-2.5 text-[#a5adbb]" />
                          Ready
                        </span>
                      )}

                      {investigationId && (
                        <button
                          onClick={handleNewInvestigationClick}
                          className="flex items-center gap-1 text-[10px] font-mono text-[#a18dff] hover:text-white bg-[#7c5cff]/15 hover:bg-[#7c5cff] border border-[#7c5cff]/30 px-2 py-0.5 rounded transition-colors cursor-pointer"
                          title="Start a new investigation thread"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>New Thread</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {error && (
                    <div className="mx-4 mt-3 p-3 bg-[#fb7185]/10 border border-[#fb7185]/30 rounded-xl text-xs text-[#fb7185] flex items-center justify-between">
                      <span>{error}</span>
                      <button onClick={dismissError} className="underline font-mono ml-2 cursor-pointer">
                        dismiss
                      </button>
                    </div>
                  )}

                  <ChatHistory history={history} loading={loading} onOpenByok={() => setCurrentView('byok')} />
                  <ChatInput
                    message={message}
                    setMessage={setMessage}
                    loading={loading}
                    canSend={canSend}
                    onSend={sendMessage}
                  />
                </div>
              )}

              {currentView === 'byok' && (
                <ProviderHubPage onNavigateWorkbench={() => setCurrentView('workbench')} />
              )}

              {currentView === 'detail' && (
                <InvestigationDetailPage
                  investigationId={selectedCaseId}
                  onBack={() => setCurrentView('history')}
                  onContinueInvestigation={(id) => {
                    loadInvestigation(id);
                    setCurrentView('workbench');
                  }}
                />
              )}

              {currentView === 'history' && (
                <InvestigationHistoryPage
                  onSelectInvestigation={(id) => {
                    setSelectedCaseId(id);
                    setCurrentView('detail');
                  }}
                  onContinueInvestigation={(id) => {
                    loadInvestigation(id);
                    setCurrentView('workbench');
                  }}
                  onNewInvestigation={handleNewInvestigationClick}
                />
              )}

              {currentView === 'settings' && (
                <AccountSettingsPage
                  onNavigateByok={() => setCurrentView('byok')}
                  onLogout={handleLogout}
                />
              )}
            </div>
          </main>
        </div>
      )}
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
