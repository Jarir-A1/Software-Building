import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { ThemeMode } from '../shared/api';

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  mode: ThemeMode;
  fontSize: number;
  onModeChange: (mode: ThemeMode) => void;
  children: ReactNode;
}

// Applies the theme (data-theme attribute) and base font size to the document
// root and exposes controls via context. The parent owns persistence: mode
// changes are reported through onModeChange.
export function ThemeProvider({
  mode,
  fontSize,
  onModeChange,
  children,
}: ThemeProviderProps): ReactElement {
  // Tracks the OS color-scheme preference. It only influences the resolved
  // theme while mode is "system", but we keep it in sync via an event listener
  // rather than reading it during render.
  const [systemDark, setSystemDark] = useState<boolean>(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (): void => setSystemDark(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  // resolved is derived, not stored, so no setState-in-effect is needed.
  const resolved: 'light' | 'dark' =
    mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved);
  }, [resolved]);

  useEffect(() => {
    document.documentElement.style.setProperty('--base-font-size', `${fontSize}px`);
  }, [fontSize]);

  const setMode = useCallback((next: ThemeMode) => onModeChange(next), [onModeChange]);

  const toggle = useCallback(() => {
    onModeChange(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved, onModeChange]);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolved, setMode, toggle }),
    [mode, resolved, setMode, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
