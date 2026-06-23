import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';

// App version for cache invalidation
const APP_VERSION = '1.0.2';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function clearInvalidStorage(): void {
  try {
    const storedVersion = localStorage.getItem('app_version');

    if (storedVersion !== APP_VERSION) {
      console.log('[AUTH] Version mismatch. Stored:', storedVersion, 'Current:', APP_VERSION);

      // Clear old Supabase auth tokens that might be corrupted
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.includes('supabase.auth.token') ||
          key.includes('sb-') ||
          key.includes('-auth-token')
        )) {
          keysToRemove.push(key);
        }
      }

      // Only clear if there are suspicious keys
      if (keysToRemove.length > 0) {
        console.log('[AUTH] Clearing', keysToRemove.length, 'old auth keys');
        keysToRemove.forEach(key => localStorage.removeItem(key));
      }

      // Update version
      localStorage.setItem('app_version', APP_VERSION);
    }
  } catch (err) {
    console.error('[AUTH] Error clearing storage:', err);
  }
}

async function validateSession(session: Session | null): Promise<boolean> {
  if (!session) return false;

  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      console.error('[SESSION] Validation error:', error);
      return false;
    }

    if (!user) {
      console.log('[SESSION] No user returned, session invalid');
      return false;
    }

    console.log('[SESSION] Session valid for user:', user.id);
    return true;
  } catch (err) {
    console.error('[SESSION] Exception validating session:', err);
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const isInitialized = useRef(false);
  const profileFetched = useRef(new Set<string>());

  const ensureProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    // Skip if already fetched this session
    if (profileFetched.current.has(userId)) {
      console.log('[PROFILE] Already fetched this session, checking cache...');

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        console.log('[PROFILE] Cached profile found');
        return data;
      }
      return null;
    }

    try {
      console.log('[PROFILE] Fetching/creating profile for user:', userId);

      // Try to get existing profile
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError) {
        console.error('[PROFILE] Fetch error:', fetchError);
        return null;
      }

      if (existingProfile) {
        console.log('[PROFILE] Found existing profile:', existingProfile.id);
        profileFetched.current.add(userId);
        return existingProfile;
      }

      // Create new profile using upsert to handle race conditions
      console.log('[PROFILE] Creating new profile...');

      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .upsert(
          { user_id: userId },
          { onConflict: 'user_id', ignoreDuplicates: true }
        )
        .select()
        .maybeSingle();

      if (insertError) {
        console.error('[PROFILE] Insert error:', insertError);

        // Try fetching again in case of race condition
        const { data: retryProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (retryProfile) {
          profileFetched.current.add(userId);
          return retryProfile;
        }
        return null;
      }

      if (newProfile) {
        console.log('[PROFILE] Created profile:', newProfile.id);
        profileFetched.current.add(userId);
        return newProfile;
      }

      return null;
    } catch (err) {
      console.error('[PROFILE] Exception:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    const initAuth = async () => {
      console.log('[AUTH] Starting auth initialization...');
      console.log('[AUTH] App version:', APP_VERSION);

      // Clear invalid storage on version change
      clearInvalidStorage();

      try {
        // Get initial session
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('[AUTH] getSession error:', sessionError);

          // Try to recover by signing out
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }

        console.log('[SESSION] Initial session:', initialSession ? 'exists' : 'null');

        if (initialSession) {
          // Validate the session
          const isValid = await validateSession(initialSession);

          if (!isValid) {
            console.log('[SESSION] Invalid session, signing out...');
            await supabase.auth.signOut();
            setLoading(false);
            return;
          }

          console.log('[SESSION] Session valid');
          setSession(initialSession);
          setUser(initialSession.user);

          // Fetch/create profile
          const profile = await ensureProfile(initialSession.user.id);
          if (profile) {
            setProfile(profile);
          }
        }
      } catch (err) {
        console.error('[AUTH] Exception during init:', err);

        // Try to recover
        try {
          await supabase.auth.signOut();
        } catch {
          // Ignore signout errors
        }
      } finally {
        console.log('[AUTH] Initialization complete, setting loading=false');
        setLoading(false);
      }
    };

    initAuth();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('[AUTH] Auth state change:', event);
        console.log('[SESSION] New session:', newSession ? 'exists' : 'null');

        // Don't process during initial load
        if (event === 'INITIAL_SESSION') {
          return;
        }

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (event === 'SIGNED_IN' && newSession?.user) {
          const profile = await ensureProfile(newSession.user.id);
          if (profile) {
            setProfile(profile);
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('[AUTH] Signed out, clearing state');
          setProfile(null);
          profileFetched.current.clear();
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('[AUTH] Token refreshed');
        } else if (event === 'USER_UPDATED') {
          console.log('[AUTH] User updated');
        }
      }
    );

    return () => {
      console.log('[AUTH] Unsubscribing from auth changes');
      subscription.unsubscribe();
    };
  }, [ensureProfile]);

  const signUp = async (email: string, password: string, name?: string) => {
    console.log('[AUTH] signUp called for:', email);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        },
      });

      if (error) {
        console.error('[AUTH] signUp error:', error);
        return { error: new Error(error.message) };
      }

      console.log('[AUTH] signUp successful');
      return { error: null };
    } catch (err) {
      console.error('[AUTH] signUp exception:', err);
      return { error: err as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    console.log('[AUTH] signIn called for:', email);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[AUTH] signIn error:', error);
        return { error: new Error(error.message) };
      }

      console.log('[AUTH] signIn successful');
      return { error: null };
    } catch (err) {
      console.error('[AUTH] signIn exception:', err);
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    console.log('[AUTH] signOut called');

    try {
      await supabase.auth.signOut();

      setUser(null);
      setProfile(null);
      setSession(null);
      profileFetched.current.clear();

      console.log('[AUTH] signOut complete');
    } catch (err) {
      console.error('[AUTH] signOut error:', err);

      // Clear state anyway
      setUser(null);
      setProfile(null);
      setSession(null);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) {
      console.warn('[AUTH] updateProfile called without user');
      return { error: new Error('No user logged in') };
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id);

      if (error) {
        console.error('[AUTH] updateProfile error:', error);
        return { error: new Error(error.message) };
      }

      if (profile) {
        setProfile({ ...profile, ...updates });
      }

      console.log('[AUTH] Profile updated');
      return { error: null };
    } catch (err) {
      console.error('[AUTH] updateProfile exception:', err);
      return { error: err as Error };
    }
  };

  console.log('[AUTH] Render - loading:', loading, 'user:', user ? 'exists' : 'null');

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        signUp,
        signIn,
        signOut,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
