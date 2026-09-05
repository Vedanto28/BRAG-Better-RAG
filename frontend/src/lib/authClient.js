import { createAuthClient } from 'better-auth/react';

function getAuthBaseUrl() {
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return import.meta.env.VITE_AUTH_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
    }
    // Production browser on Vercel: always same-origin
    return window.location.origin;
  }
  return 'https://brag-better-rag.vercel.app';
}

const baseURL = getAuthBaseUrl();


export const authClient = createAuthClient({
  baseURL,
  fetchOptions: {
    credentials: 'include'
  }
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
export default authClient;
