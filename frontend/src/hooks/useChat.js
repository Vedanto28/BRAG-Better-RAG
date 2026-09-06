import { useState, useEffect, useMemo, useCallback } from 'react';
import { sendChatMessage, fetchInvestigationDetail, updateInvestigationStatusApi } from '../services/chatService.js';

const STORAGE_KEY = 'brag_active_investigation_id';
const INITIAL_ERROR = null;

export function useChat() {
  const [investigationId, setInvestigationId] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) || null;
    }
    return null;
  });
  const [investigationMeta, setInvestigationMeta] = useState(null);
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isHydrating, setIsHydrating] = useState(false);
  const [error, setError] = useState(INITIAL_ERROR);

  // Hydrate persistent investigation from PostgreSQL on mount / reload
  const hydrateInvestigation = useCallback(async (idToHydrate) => {
    if (!idToHydrate) return;
    setIsHydrating(true);
    try {
      const res = await fetchInvestigationDetail(idToHydrate);
      if (res && res.investigation) {
        const inv = res.investigation;
        setInvestigationId(inv.id);
        setInvestigationMeta({
          id: inv.id,
          title: inv.title || 'Untitled Investigation',
          status: inv.status || 'active',
          created_at: inv.created_at,
          updated_at: inv.updated_at
        });

        // Hydrate message history from database records
        if (Array.isArray(inv.messages) && inv.messages.length > 0) {
          const formattedHistory = inv.messages.map((m) => ({
            id: m.id || crypto.randomUUID(),
            role: m.role,
            content: m.content,
            metadata: m.metadata || null,
            timestamp: m.created_at
              ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }));
          setHistory(formattedHistory);
        }
      }
    } catch (err) {
      console.warn('[useChat] Failed to hydrate investigation from storage:', err.message);
      // Clean up stale or inaccessible ID
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
      setInvestigationId(null);
      setInvestigationMeta(null);
    } finally {
      setIsHydrating(false);
    }
  }, []);

  useEffect(() => {
    if (investigationId && history.length === 0) {
      hydrateInvestigation(investigationId);
    }
  }, [investigationId, hydrateInvestigation, history.length]);

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
      const data = await sendChatMessage(trimmedMessage, {
        investigationId: investigationId || undefined
      });

      const returnedInvId = data.investigationId || data.investigation?.id;
      if (returnedInvId) {
        setInvestigationId(returnedInvId);
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, returnedInvId);
        }
      }

      if (data.investigation) {
        setInvestigationMeta(data.investigation);
      } else if (returnedInvId && !investigationMeta) {
        setInvestigationMeta({
          id: returnedInvId,
          title: trimmedMessage.slice(0, 45),
          status: 'active'
        });
      }

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

  function startNewInvestigation() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    setInvestigationId(null);
    setInvestigationMeta(null);
    setHistory([]);
    setError(INITIAL_ERROR);
  }

  async function loadInvestigation(id) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, id);
    }
    setInvestigationId(id);
    await hydrateInvestigation(id);
  }

  async function setStatus(nextStatus) {
    if (!investigationId) return;
    try {
      const res = await updateInvestigationStatusApi(investigationId, nextStatus);
      if (res && res.investigation) {
        setInvestigationMeta((prev) => ({
          ...(prev || {}),
          status: res.investigation.status || nextStatus
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update investigation status.');
    }
  }

  function dismissError() {
    setError(INITIAL_ERROR);
  }

  return {
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
    dismissError,
  };
}
