import { useMemo, useState } from 'react';

const INITIAL_ERROR = null;
const API_URL = 'http://localhost:5000/api/chat';

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
    };

    setHistory((currentHistory) => [...currentHistory, userEntry]);
    setMessage('');
    setError(INITIAL_ERROR);
    setLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: trimmedMessage }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to get a response from the server.');
      }

      const assistantEntry = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.answer || 'No response returned.',
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
