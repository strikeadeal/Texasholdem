import { useState, useEffect } from 'react';

/**
 * Returns true if the user has requested reduced motion via the OS preference.
 * Components should skip or simplify animations when this is true.
 */
export function useReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';

  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}
