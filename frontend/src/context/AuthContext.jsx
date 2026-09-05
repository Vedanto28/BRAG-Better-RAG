import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession, signOut, getSession } from '../lib/authClient.js';
import { fetchUserProfile, updateUserProfileApi, updateUserPreferencesApi } from '../services/chatService.js';

const AuthContext = createContext({
  user: null,
  session: null,
  profile: null,
  preferences: null,
  isLoading: true,
  isAuthenticated: false,
  logout: async () => {},
  refetchSession: async () => {},
  updateProfile: async () => {},
  updatePreferences: async () => {}
});

export function AuthProvider({ children }) {
  const { data: betterAuthSession, isPending: sessionPending, error: sessionError } = useSession();
  const [profile, setProfile] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);

  const user = betterAuthSession?.user || null;
  const session = betterAuthSession?.session || null;
  const isAuthenticated = Boolean(user);

  // Load BRAG-specific profile and preferences when authenticated
  const loadProfileAndPreferences = useCallback(async () => {
    if (!isAuthenticated) {
      setProfile(null);
      setPreferences(null);
      return;
    }

    try {
      setIsProfileLoading(true);
      const res = await fetchUserProfile();
      if (res && res.success) {
        setProfile(res.profile || null);
        setPreferences(res.preferences || null);
      }
    } catch (err) {
      console.warn('[AuthContext] Error loading user profile/preferences:', err.message);
    } finally {
      setIsProfileLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!sessionPending) {
      setInitialCheckComplete(true);
    }
  }, [sessionPending]);

  useEffect(() => {
    if (isAuthenticated) {
      loadProfileAndPreferences();
    } else {
      setProfile(null);
      setPreferences(null);
    }
  }, [isAuthenticated, loadProfileAndPreferences]);

  const logout = useCallback(async () => {
    try {
      await signOut();
    } catch (err) {
      console.warn('[AuthContext] Sign-out error:', err);
    } finally {
      setProfile(null);
      setPreferences(null);
    }
  }, []);

  const refetchSession = useCallback(async () => {
    try {
      await getSession();
      if (isAuthenticated) {
        await loadProfileAndPreferences();
      }
    } catch (err) {
      console.warn('[AuthContext] Session refetch error:', err);
    }
  }, [isAuthenticated, loadProfileAndPreferences]);

  const updateProfile = useCallback(async (profileData) => {
    const res = await updateUserProfileApi(profileData);
    if (res && res.success) {
      setProfile(res.profile);
    }
    return res;
  }, []);

  const updatePreferences = useCallback(async (preferencesData) => {
    const res = await updateUserPreferencesApi(preferencesData);
    if (res && res.success) {
      setPreferences(res.preferences);
    }
    return res;
  }, []);

  const isLoading = !initialCheckComplete || (sessionPending && !user);

  const value = {
    user,
    session,
    profile,
    preferences,
    isLoading,
    isAuthenticated,
    logout,
    refetchSession,
    updateProfile,
    updatePreferences
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
