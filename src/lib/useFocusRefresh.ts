import { useEffect } from 'react';

/**
 * useFocusRefresh — calls the given callback when the tab/app regains focus.
 *
 * This is the realtime fallback for when Supabase Realtime temporarily
 * disconnects (e.g. mobile app backgrounded, network dropped). On React
 * Native, replace `document.visibilitychange` / `window.focus` with
 * AppState change events.
 */
export function useFocusRefresh(callback: () => void): void {
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        callback();
      }
    };
    document.addEventListener('visibilitychange', handler);
    window.addEventListener('focus', handler);
    return () => {
      document.removeEventListener('visibilitychange', handler);
      window.removeEventListener('focus', handler);
    };
  }, [callback]);
}
