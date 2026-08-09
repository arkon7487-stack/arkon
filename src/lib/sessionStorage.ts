/**
 * SessionStorageAdapter — abstract storage layer for session state.
 *
 * Web implementation uses localStorage. On React Native / Expo, replace
 * this module with an implementation backed by Expo SecureStore.
 *
 * The business logic in auth.tsx and elsewhere should only depend on
 * this interface, never on localStorage directly.
 */

export interface SessionStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

class LocalStorageAdapter implements SessionStorageAdapter {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage may be full or unavailable — non-fatal */
    }
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* non-fatal */
    }
  }
}

let adapter: SessionStorageAdapter = new LocalStorageAdapter();

export function setSessionStorageAdapter(a: SessionStorageAdapter): void {
  adapter = a;
}

export const sessionStorage = {
  get: (key: string): string | null => adapter.getItem(key),
  set: (key: string, value: string): void => adapter.setItem(key, value),
  remove: (key: string): void => adapter.removeItem(key),
};
