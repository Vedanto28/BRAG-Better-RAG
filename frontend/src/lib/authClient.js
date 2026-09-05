import { createAuthClient } from 'better-auth/react';

const baseURL = import.meta.env.VITE_AUTH_URL || import.meta.env.VITE_API_BASE_URL || (
  typeof window !== 'undefined'
    ? (window.location.hostname === 'localhost' ? 'http://localhost:5000' : window.location.origin)
    : 'https://brag-better-rag.vercel.app'
);

export const authClient = createAuthClient({
  baseURL,
  fetchOptions: {
    credentials: 'include'
  }
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
export default authClient;
