import React, { useId } from 'react';
import { Send, CornerDownLeft } from 'lucide-react';

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
      className="sticky bottom-0 z-30 border-t border-[#1b1e24] bg-[#0c0d10]/95 px-4 py-3 backdrop-blur-md"
      onSubmit={handleSubmit}
    >
      <div className="mx-auto flex w-full max-w-4xl items-end gap-2.5">
        <label htmlFor={inputId} className="sr-only">
          Ask Mechamaru anything
        </label>
        <div className="flex-1 relative flex items-center bg-[#131519] border border-[#24272f] focus-within:border-[#7c5cff] focus-within:ring-1 focus-within:ring-[#7c5cff]/30 rounded-xl transition-all">
          <textarea
            id={inputId}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Mechamaru or paste an error log / command..."
            rows={1}
            disabled={loading}
            aria-disabled={loading}
            className="w-full resize-none bg-transparent px-4 py-3 text-xs md:text-sm text-[#f5f7fa] placeholder-[#6c7280] outline-none disabled:cursor-not-allowed disabled:opacity-50 font-sans"
          />
        </div>
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send message"
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#7c5cff] hover:bg-[#8f6dff] active:scale-95 text-white shadow-md shadow-[#7c5cff]/20 transition-all disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#7c5cff] cursor-pointer flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
      <div className="mx-auto mt-2 flex items-center justify-between w-full max-w-4xl text-[10px] font-mono text-[#6c7280] px-1">
        <span>Enter to send, Shift + Enter for new line</span>
        <span className="hidden sm:inline-flex items-center gap-1">
          <CornerDownLeft className="w-2.5 h-2.5" />
          <span>Agent Orchestration Active</span>
        </span>
      </div>
    </form>
  );
}
