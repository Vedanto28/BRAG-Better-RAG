import { useId } from 'react';

export default function ChatInput({
  message,
  setMessage,
  loading,
  canSend,
  onSend,
}) {
  const inputId = useId();

  function handleSubmit(event) {
    event.preventDefault();
    onSend();
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  }

  return (
    <form
      className="sticky bottom-0 z-30 border-t border-gray-200/80 bg-white/90 px-4 py-4 backdrop-blur-xl dark:border-gray-800/80 dark:bg-gray-950/85 sm:px-6 lg:px-8"
      onSubmit={handleSubmit}
    >
      <div className="mx-auto flex w-full max-w-5xl items-end gap-3">
        <label htmlFor={inputId} className="sr-only">
          Ask Mechamaru anything
        </label>
        <textarea
          id={inputId}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Mechamaru anything..."
          rows={1}
          disabled={loading}
          aria-disabled={loading}
          className="min-h-[3.25rem] flex-1 resize-none rounded-3xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-teal-400 focus:ring-4 focus:ring-teal-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send message"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-500 text-white shadow-lg shadow-teal-500/25 transition duration-200 hover:-translate-y-0.5 hover:bg-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
        >
          <i className="bi bi-send-fill text-base" aria-hidden="true" />
        </button>
      </div>
      <p className="mx-auto mt-2 w-full max-w-5xl text-xs text-gray-500 dark:text-gray-400">
        Press Enter to send, Shift + Enter for a new line.
      </p>
    </form>
  );
}
