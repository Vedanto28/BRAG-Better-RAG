import { useEffect, useRef } from 'react';
import LoadingBubble from './LoadingBubble.jsx';
import MessageBubble from './MessageBubble.jsx';

export default function ChatHistory({ history, loading }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [history, loading]);

  if (history.length === 0 && !loading) {
    return (
      <section className="flex min-h-[calc(100vh-14rem)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="max-w-2xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-teal-600 dark:text-teal-400">
            Welcome to BRAG
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 sm:text-4xl">
            Better RAG, built for reasoning and action.
          </h2>
          <p className="mx-auto mt-4 max-w-xl whitespace-pre-line text-base leading-7 text-gray-600 dark:text-gray-300 sm:text-lg">
            Ask Mechamaru anything.
            {'\n\n'}
            I can retrieve information,
            reason through problems,
            execute workflows,
            and assist with intelligent tasks.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-live="polite"
      aria-relevant="additions text"
      className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth sm:px-6 lg:px-8"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        {history.map((entry) => (
          <MessageBubble key={entry.id} role={entry.role} content={entry.content} />
        ))}
        {loading ? <LoadingBubble /> : null}
        <div ref={scrollRef} />
      </div>
    </section>
  );
}
