export default function MessageBubble({ role, content }) {
  const isUser = role === 'user';

  return (
    <article
      className={`flex w-full animate-[fade-in_240ms_ease-out] ${isUser ? 'justify-end' : 'justify-start'}`}
      aria-label={isUser ? 'You' : 'Mechamaru'}
    >
      <div className={`max-w-[min(42rem,85%)] ${isUser ? 'text-right' : 'text-left'}`}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
          {isUser ? 'You' : 'Mechamaru'}
        </p>
        <div
          className={[
            'rounded-3xl px-4 py-3 text-sm leading-6 shadow-sm transition-colors sm:text-[15px]',
            isUser
              ? 'bg-teal-500 text-white'
              : 'border border-gray-200 bg-gray-200 text-gray-900 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-100',
          ].join(' ')}
        >
          <p className="whitespace-pre-wrap break-words">{content}</p>
        </div>
      </div>
    </article>
  );
}
