import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useRef,
  useCallback,
} from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';

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

/* =========================
   STORAGE CLEANUP SAFE
========================= */
function clearInvalidStorage() {
  try {
    const storedVersion = localStorage.getItem('app_version');

    if (storedVersion === APP_VERSION) return;

    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.includes('supabase') || key.includes('sb-') || key.includes('auth'))
      ) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((k) => localStorage.removeItem(k));

    localStorage.setItem('app_version', APP_VERSION);
  } catch {}
}

/* =========================
   PROVIDER
========================= */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const initialized = useRef(false);
  const profileLoading = useRef(false);

  /* =========================
     PROFILE LOADER (SAFE)
  ========================= */
  const ensureProfile = useCallback(async (userId: string) => {
    if (profileLoading.current) return null;
    profileLoading.current = true;

    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (data) return data;

      const { data: created } = await supabase
        .from('profiles')
        .insert({ user_id: userId })
        .select()
        .maybeSingle();

      return created || null;
    } finally {
      profileLoading.current = false;
    }
  }, []);

  /* =========================
     INIT AUTH (RUN ONCE)
  ========================= */
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    let mounted = true;

    const init = async () => {
      clearInvalidStorage();

      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        setLoading(false);
        return;
      }

      const session = data.session;

      if (session?.user) {
        setSession(session);
        setUser(session.user);

        const prof = await ensureProfile(session.user.id);
        if (mounted) setProfile(prof);
      }

      setLoading(false);
    };

    init();

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange(async (event, newSession) => {
        if (!mounted) return;

        if (event === 'INITIAL_SESSION') return;

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (event === 'SIGNED_IN' && newSession?.user) {
          const prof = await ensureProfile(newSession.user.id);
          if (mounted) setProfile(prof);
        }

        if (event === 'SIGNED_OUT') {
          setProfile(null);
        }
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [ensureProfile]);

  /* =========================
     AUTH ACTIONS
  ========================= */
  const signUp = async (email: string, password: string, name?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (error) return { error: new Error(error.message) };
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return { error: new Error(error.message) };
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('No user') };

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', user.id);

    if (error) return { error: new Error(error.message) };

    setProfile((prev) => (prev ? { ...prev, ...updates } : prev));

    return { error: null };
  };

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

/* =========================
   HOOK
========================= */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
