import { useEffect } from 'react';
import ChatHistory from './components/ChatHistory.jsx';
import ChatInput from './components/ChatInput.jsx';
import Header from './components/Header.jsx';
import { useChat } from './hooks/useChat.js';

function useSystemTheme() {
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      document.documentElement.classList.toggle('dark', mediaQuery.matches);
      document.documentElement.style.colorScheme = mediaQuery.matches ? 'dark' : 'light';
    };

    applyTheme();
    mediaQuery.addEventListener('change', applyTheme);

    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, []);
}

function App() {
  useSystemTheme();
  const { history, message, setMessage, loading, error, canSend, sendMessage, dismissError } = useChat();

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="absolute right-0 top-24 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <Header />

      {error ? (
        <div className="border-b border-red-200 bg-red-500 px-4 py-3 text-white dark:border-red-900/60">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
            <p className="text-sm font-medium">{error || 'Something went wrong. Please try again.'}</p>
            <button
              type="button"
              onClick={dismissError}
              className="rounded-full border border-white/30 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] transition hover:bg-white/10 focus:outline-none focus:ring-4 focus:ring-white/20"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <main className="relative flex min-h-0 flex-1 flex-col">
        <ChatHistory history={history} loading={loading} />
        <ChatInput
          message={message}
          setMessage={setMessage}
          loading={loading}
          canSend={canSend}
          onSend={sendMessage}
        />
      </main>
    </div>
  );
}

export default App;
