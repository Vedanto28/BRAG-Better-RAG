function getApiBase() {
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      const customUrl = import.meta.env.VITE_API_URL;
      if (customUrl) {
        const sanitized = customUrl.replace(/\/+$/, '').replace(/\/chat$/, '');
        return sanitized.endsWith('/api') ? sanitized : `${sanitized}/api`;
      }
      return 'http://localhost:5000/api';
    }
    // Production browser: ALWAYS same-origin /api via Vercel proxy
    return '/api';
  }
  return '/api';
}

const API_BASE = getApiBase();
const CHAT_URL = `${API_BASE}/chat`;


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
 * Sends an investigation message to the BRAG agent orchestrator with credentials.
 * @param {string} message The user prompt or investigation query.
 * @param {object} [options] Optional custom headers, investigationId, or signals.
 * @returns {Promise<{ answer: string, success: boolean, metadata?: object }>}
 */
export async function sendChatMessage(message, options = {}) {
  const byokHeaders = getByokHeaders();

  const response = await fetch(CHAT_URL, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...byokHeaders,
      ...(options.headers || {})
    },
    body: JSON.stringify({
      message,
      investigationId: options.investigationId || undefined
    }),
    signal: options.signal
  });

  let data;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = { success: false, error: { message: 'Invalid JSON response from server.' } };
    }
  } else {
    const text = await response.text();
    data = {
      success: false,
      error: {
        message: response.status === 401
          ? 'Authentication required. Please log in to start investigations.'
          : `Server error (${response.status}): ${text.slice(0, 120)}`
      }
    };
  }

  if (!response.ok || !data.success) {
    const errObj = data.error || {};
    throw new Error(errObj.message || data.message || 'Failed to get a response from the server.');
  }

  return data;
}

/**
 * Retrieves investigations list for authenticated user.
 */
export async function fetchUserInvestigations() {
  const res = await fetch(`${API_BASE}/investigations`, {
    credentials: 'include'
  });
  if (!res.ok) {
    let errMessage = 'Failed to load investigations';
    try {
      const errData = await res.json();
      errMessage = errData.error?.message || errMessage;
    } catch {}
    throw new Error(errMessage);
  }
  return res.json();
}

/**
 * Retrieves investigation detail for authenticated user.
 */
export async function fetchInvestigationDetail(id) {
  const res = await fetch(`${API_BASE}/investigations/${id}`, {
    credentials: 'include'
  });
  if (!res.ok) {
    let errMessage = 'Failed to load investigation details';
    try {
      const errData = await res.json();
      errMessage = errData.error?.message || errMessage;
    } catch {}
    throw new Error(errMessage);
  }
  return res.json();
}

/**
 * Retrieves profile and preferences for authenticated user.
 */
export async function fetchUserProfile() {
  const res = await fetch(`${API_BASE}/user/profile`, {
    credentials: 'include'
  });
  if (!res.ok) {
    let errMessage = 'Failed to load user profile';
    try {
      const errData = await res.json();
      errMessage = errData.error?.message || errMessage;
    } catch {}
    throw new Error(errMessage);
  }
  return res.json();
}

/**
 * Updates user profile details.
 */
export async function updateUserProfileApi(profileData) {
  const res = await fetch(`${API_BASE}/user/profile`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profileData)
  });
  if (!res.ok) {
    let errMessage = 'Failed to update profile';
    try {
      const errData = await res.json();
      errMessage = errData.error?.message || errMessage;
    } catch {}
    throw new Error(errMessage);
  }
  return res.json();
}

/**
 * Updates user application preferences.
 */
export async function updateUserPreferencesApi(preferencesData) {
  const res = await fetch(`${API_BASE}/user/preferences`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preferencesData)
  });
  if (!res.ok) {
    let errMessage = 'Failed to update preferences';
    try {
      const errData = await res.json();
      errMessage = errData.error?.message || errMessage;
    } catch {}
    throw new Error(errMessage);
  }
  return res.json();
}
