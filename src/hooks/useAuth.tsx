import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useRef,
} from 'react';

import { supabase } from '../lib/supabase';

type AuthContextType = {
  user: any;
  profile: any;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const initialized = useRef(false);
  const authReady = useRef(false);

  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      return data ?? null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    let mounted = true;

    const init = async () => {
      try {
        setLoading(true);

        const { data, error } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          console.warn('[AUTH] getSession error:', error.message);
        }

        const session = data.session;
        const currentUser = session?.user ?? null;

        setUser(currentUser);

        if (currentUser) {
          const p = await fetchProfile(currentUser.id);
          if (mounted) setProfile(p);
        } else {
          setProfile(null);
        }

      } catch (err) {
        console.error('[AUTH] init error:', err);
      } finally {
        if (mounted) {
          authReady.current = true;
          setLoading(false);
        }
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // 🔥 IMPORTANTE: ignora eventos antes do init terminar
      if (!authReady.current) return;

      const currentUser = session?.user ?? null;

      setUser(currentUser);

      if (currentUser) {
        fetchProfile(currentUser.id).then((p) => {
          if (mounted) setProfile(p);
        });
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
