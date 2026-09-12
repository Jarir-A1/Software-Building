import { useEffect, useState } from 'react';

// Returns a debounced copy of value that only updates after the value has been
// stable for delay milliseconds. Used to avoid firing a search/suggest IPC
// call on every keystroke.
export function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// Feature detects the Web Speech API speech synthesis support once. The check
// runs in the state initializer so it is evaluated a single time and never
// accessed during render as a ref.
export function useSpeechSupported(): boolean {
  const [supported] = useState<boolean>(
    () =>
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof window.speechSynthesis?.speak === 'function',
  );
  return supported;
}
