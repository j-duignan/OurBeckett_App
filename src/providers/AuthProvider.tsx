import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { fetchProfileById } from '@/api/profiles';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/models';

type SignedInUser = { userId: string; profile: Profile };

type AuthContextValue = {
  session: Session | null;
  userId: string | null;
  profile: Profile | null;
  /** True until the stored session (and profile, if signed in) has loaded. */
  initialising: boolean;
  profileError: string | null;
  /** While resetting a password the user is signed in but must stay on the auth flow. */
  recovering: boolean;
  setRecovering: (value: boolean) => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Last signed-in user, so screens being torn down during sign-out never crash. */
  lastKnownUser: SignedInUser | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const previousUserId = useRef<string | null>(null);
  const lastKnownUser = useRef<SignedInUser | null>(null);

  const userId = session?.user.id ?? null;
  if (userId && profile && profile.id === userId) {
    lastKnownUser.current = { userId, profile };
  }

  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) setSession(data.session);
      })
      .finally(() => {
        if (mounted) setSessionLoaded(true);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const loadProfile = useCallback(async (id: string) => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const result = await fetchProfileById(id);
      if (!result) throw new Error('Your profile could not be found.');
      setProfile(result);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Could not load your profile.');
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    // Never let one student's cached data leak into another session.
    if (previousUserId.current !== userId) {
      if (previousUserId.current) queryClient.clear();
      previousUserId.current = userId;
    }
    if (userId) {
      setProfile((current) => (current && current.id !== userId ? null : current));
      loadProfile(userId);
    } else {
      setProfile(null);
      setProfileError(null);
    }
  }, [userId, loadProfile, queryClient]);

  const refreshProfile = useCallback(async () => {
    if (userId) await loadProfile(userId);
  }, [userId, loadProfile]);

  const signOut = useCallback(async () => {
    setRecovering(false);
    await supabase.auth.signOut();
  }, []);

  // Signed in but profile not fetched yet (and no error) still counts as loading,
  // so the router never briefly shows the wrong stack.
  const initialising = !sessionLoaded || (Boolean(userId) && !profile && (profileLoading || !profileError));

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      userId,
      profile,
      initialising,
      profileError,
      recovering,
      setRecovering,
      refreshProfile,
      signOut,
      lastKnownUser: lastKnownUser.current,
    }),
    [session, userId, profile, initialising, profileError, recovering, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/**
 * For screens that only render when signed in. Falls back to the last
 * signed-in user for the single render between sign-out and the router
 * unmounting the signed-in stack.
 */
export function useCurrentUser(): SignedInUser {
  const { userId, profile, lastKnownUser } = useAuth();
  if (userId && profile) return { userId, profile };
  if (lastKnownUser) return lastKnownUser;
  throw new Error('useCurrentUser called without a signed-in user');
}
