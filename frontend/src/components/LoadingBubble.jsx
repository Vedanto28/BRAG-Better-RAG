export default function LoadingBubble() {
  return (
    <article className="flex justify-start" aria-live="polite" aria-busy="true">
      <div className="max-w-[min(42rem,85%)] text-left">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
          Mechamaru
        </p>
        <div className="space-y-3 rounded-3xl border border-gray-200 bg-gray-200 px-4 py-4 dark:border-gray-800 dark:bg-gray-800">
          <p className="text-sm text-gray-700 dark:text-gray-300">Mechamaru is thinking...</p>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-gray-400/80 dark:bg-gray-500/80" />
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-gray-400/80 [animation-delay:120ms] dark:bg-gray-500/80" />
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-gray-400/80 [animation-delay:240ms] dark:bg-gray-500/80" />
          </div>
        </div>
      </div>
    </article>
  );
}
