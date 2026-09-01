import { useMemo, useState } from 'react';
import { sendChatMessage } from '../services/chatService.js';

const INITIAL_ERROR = null;

export function useChat() {
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(INITIAL_ERROR);

  const canSend = useMemo(() => message.trim().length > 0 && !loading, [message, loading]);

  async function sendMessage() {
    const trimmedMessage = message.trim();

    if (!trimmedMessage || loading) {
      return;
    }

    const userEntry = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmedMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setHistory((currentHistory) => [...currentHistory, userEntry]);
    setMessage('');
    setError(INITIAL_ERROR);
    setLoading(true);

    try {
      const data = await sendChatMessage(trimmedMessage);

      const assistantEntry = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.answer || 'No response returned.',
        metadata: data.metadata || null,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setHistory((currentHistory) => [...currentHistory, assistantEntry]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function dismissError() {
    setError(INITIAL_ERROR);
  }

  return {
    history,
    message,
    setMessage,
    loading,
    error,
    canSend,
    sendMessage,
    dismissError,
  };
}
