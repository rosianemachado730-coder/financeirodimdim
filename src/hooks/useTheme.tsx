import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { useAuth } from './useAuth';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme') as Theme;
      if (saved) return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  });

  const { updateProfile, profile } = useAuth();
  const isUpdatingFromProfile = useRef(false);
  const lastProfileTheme = useRef<string | null>(null);

  // Sync theme from profile only once on initial load
  useEffect(() => {
    if (profile?.theme && profile.theme !== lastProfileTheme.current && !isUpdatingFromProfile.current) {
      lastProfileTheme.current = profile.theme;
      const profileTheme = profile.theme as Theme;

      // Only update if different from current theme
      if (profileTheme !== theme) {
        console.log('[THEME] Syncing theme from profile:', profileTheme);
        isUpdatingFromProfile.current = true;
        setThemeState(profileTheme);
        // Reset flag after state update
        setTimeout(() => {
          isUpdatingFromProfile.current = false;
        }, 0);
      }
    }
  }, [profile?.theme, theme]);

  // Apply theme to DOM
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
    console.log('[THEME] Applied theme:', theme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    console.log('[THEME] setTheme called:', newTheme);
    isUpdatingFromProfile.current = true;
    setThemeState(newTheme);
    lastProfileTheme.current = newTheme;

    // Update profile only if different and user is logged in
    if (profile && profile.theme !== newTheme) {
      console.log('[THEME] Updating profile theme');
      updateProfile({ theme: newTheme }).catch((err) => {
        console.error('[THEME] Error updating profile:', err);
      });
    }

    // Reset flag after a tick
    setTimeout(() => {
      isUpdatingFromProfile.current = false;
    }, 0);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
