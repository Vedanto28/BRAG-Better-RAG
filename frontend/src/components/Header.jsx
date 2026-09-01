export default function Header({ onOpenByok }) {
  return (
    <header className="sticky top-0 z-30 border-b border-gray-200/80 bg-white/90 backdrop-blur-xl dark:border-gray-800/80 dark:bg-gray-950/85">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-500 text-white shadow-lg shadow-teal-500/25">
          <i className="bi bi-chat-dots-fill text-lg" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100 sm:text-xl">
              BRAG
            </h1>
            <span className="rounded-full border border-teal-500/20 bg-teal-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-teal-700 dark:text-teal-300">
              Powered by Mechamaru
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Better RAG Assistant
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={onOpenByok}
            className="flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <i className="bi bi-key-fill text-teal-500"></i>
            <span>API Keys</span>
          </button>
        </div>
      </div>
    </header>
  );
}
