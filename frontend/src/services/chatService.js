const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/chat';

/**
 * Extracts active BYOK provider credentials from browser session storage.
 * @returns {Record<string, string>} Map of provider header names to api key values.
 */
export function getByokHeaders() {
  const byokHeaders = {};
  try {
    const storedKeys = sessionStorage.getItem('byok_keys');
    if (storedKeys) {
      const parsed = JSON.parse(storedKeys);
      for (const [provider, keyVal] of Object.entries(parsed)) {
        if (keyVal && typeof keyVal === 'string' && keyVal.trim().length > 0) {
          byokHeaders[`x-byok-${provider.toLowerCase()}-key`] = keyVal.trim();
        }
      }
    }
  } catch (e) {
    console.warn('[ChatService] Failed to parse session BYOK keys:', e);
  }
  return byokHeaders;
}

/**
 * Sends an investigation message to the BRAG agent orchestrator.
 * @param {string} message The user prompt or investigation query.
 * @param {object} [options] Optional custom headers or signals.
 * @returns {Promise<{ answer: string, success: boolean, metadata?: object }>}
 */
export async function sendChatMessage(message, options = {}) {
  const byokHeaders = getByokHeaders();

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...byokHeaders,
      ...(options.headers || {})
    },
    body: JSON.stringify({ message }),
    signal: options.signal
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    const errObj = data.error || {};
    throw new Error(errObj.message || data.message || 'Failed to get a response from the server.');
  }

  return data;
}
