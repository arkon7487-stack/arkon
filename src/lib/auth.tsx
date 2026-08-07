import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase, setClientToken } from '@/lib/supabase';
import { authService } from '@/services/authService';
import { permissionService } from '@/services/permissionService';
import { sessionStorage } from '@/lib/sessionStorage';
import type { AuthSession, Client } from '@/types';

const CLIENT_TOKEN_KEY = 'arkon_client_token';
const CLIENT_SESSION_KEY = 'arkon_client_session';
const STAFF_LAST_ACTIVITY_KEY = 'arkon_staff_last_activity';
const STAFF_INACTIVITY_MS = 48 * 60 * 60 * 1000; // 48 hours
const ACTIVITY_THROTTLE_MS = 60_000; // update at most once per minute

const CLIENT_PERMS = ['client_home', 'client_visits', 'client_invoices', 'client_support', 'client_profile'];

const AUTH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/arkon-client-auth`;

interface AuthContextValue {
  session: AuthSession | null;
  permissions: string[];
  loading: boolean;
  staffLogin: (email: string, password: string) => Promise<AuthSession>;
  clientLogin: (phone: string, pin: string) => Promise<AuthSession>;
  clientActivate: (phone: string, activationPin: string, newPin: string, confirmPin: string) => Promise<AuthSession>;
  clientCheckStatus: (phone: string) => Promise<{ needs_activation: boolean }>;
  clientChangePin: (clientId: string, currentPin: string, newPin: string, confirmPin: string) => Promise<void>;
  clientLogout: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  hasPermission: (key: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isStaffSessionExpired(): boolean {
  const lastActivity = sessionStorage.get(STAFF_LAST_ACTIVITY_KEY);
  if (!lastActivity) return false; // no record — let Supabase JWT decide
  const elapsed = Date.now() - Number(lastActivity);
  return elapsed >= STAFF_INACTIVITY_MS;
}

function touchStaffActivity(): void {
  const now = Date.now();
  const last = sessionStorage.get(STAFF_LAST_ACTIVITY_KEY);
  if (last) {
    const elapsed = now - Number(last);
    if (elapsed < ACTIVITY_THROTTLE_MS) return; // throttle
  }
  sessionStorage.set(STAFF_LAST_ACTIVITY_KEY, String(now));
}

function clearStaffSessionState(): void {
  sessionStorage.remove(STAFF_LAST_ACTIVITY_KEY);
}

async function loadStaffSession(): Promise<{ session: AuthSession; permissions: string[] } | null> {
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return null;

  if (isStaffSessionExpired()) {
    await supabase.auth.signOut();
    clearStaffSessionState();
    return null;
  }

  const profile = await authService.getCurrentProfile();
  if (!profile) return null;

  let perms: string[] = [];
  try {
    perms = profile.role?.id ? await permissionService.getForRole(profile.role.id) : [];
  } catch {
    // RLS may block permission lookup for non-admin roles — don't let this break login
  }

  touchStaffActivity();

  return {
    session: { kind: 'staff', userId, profile, role: profile?.role ?? null, permissions: perms },
    permissions: perms,
  };
}

async function loadClientSession(): Promise<{ session: AuthSession; permissions: string[] } | null> {
  const token = sessionStorage.get(CLIENT_TOKEN_KEY);
  if (!token) return null;

  try {
    const resp = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ action: 'validate_session', token }),
    });
    if (!resp.ok) { sessionStorage.remove(CLIENT_TOKEN_KEY); sessionStorage.remove(CLIENT_SESSION_KEY); return null; }
    const data = await resp.json();
    if (!data.valid) { sessionStorage.remove(CLIENT_TOKEN_KEY); sessionStorage.remove(CLIENT_SESSION_KEY); setClientToken(null); return null; }

    setClientToken(token);
    const client = data.client as Client;
    sessionStorage.set(CLIENT_SESSION_KEY, JSON.stringify(client));
    return {
      session: { kind: 'client', userId: client.id, client, role: null, permissions: CLIENT_PERMS },
      permissions: CLIENT_PERMS,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const result = await loadStaffSession();
      setSession(result?.session ?? null);
      setPermissions(result?.permissions ?? []);
    } else {
      const result = await loadClientSession();
      setSession(result?.session ?? null);
      setPermissions(result?.permissions ?? []);
    }
  };

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, supaSession) => {
      (async () => {
        if (supaSession?.user) {
          if (isStaffSessionExpired()) {
            await supabase.auth.signOut();
            clearStaffSessionState();
            setSession(null);
            setPermissions([]);
            return;
          }
          try {
            const profile = await authService.getCurrentProfile();
            if (profile) {
              let perms: string[] = [];
              try {
                perms = profile.role?.id ? await permissionService.getForRole(profile.role.id) : [];
              } catch {
                // non-fatal — RLS may block
              }
              touchStaffActivity();
              setSession({ kind: 'staff', userId: supaSession.user.id, profile, role: profile?.role ?? null, permissions: perms });
              setPermissions(perms);
            }
          } catch {
            // profile lookup failed — don't crash the auth state change
          }
        }
      })();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Throttled activity tracker — updates lastActivityAt on meaningful user interaction
  useEffect(() => {
    if (session?.kind !== 'staff') return;
    const handleActivity = () => touchStaffActivity();
    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener('click', handleActivity, opts);
    window.addEventListener('keydown', handleActivity, opts);
    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, [session?.kind]);

  const staffLogin = async (email: string, password: string): Promise<AuthSession> => {
    sessionStorage.remove(CLIENT_TOKEN_KEY);
    sessionStorage.remove(CLIENT_SESSION_KEY);
    setClientToken(null);
    const { profile, role } = await authService.signInWithPassword(email, password);
    let perms: string[] = [];
    try {
      perms = profile?.role?.id ? await permissionService.getForRole(profile.role.id) : [];
    } catch {
      // non-fatal
    }
    sessionStorage.set(STAFF_LAST_ACTIVITY_KEY, String(Date.now()));
    const s: AuthSession = { kind: 'staff', userId: profile?.user_id ?? '', profile, role, permissions: perms };
    setSession(s);
    setPermissions(perms);
    return s;
  };

  const clientLogin = async (phone: string, pin: string): Promise<AuthSession> => {
    await supabase.auth.signOut();
    const resp = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ action: 'login', phone_number: phone, pin }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error ?? 'تعذر تسجيل الدخول');

    sessionStorage.set(CLIENT_TOKEN_KEY, data.token);
    sessionStorage.set(CLIENT_SESSION_KEY, JSON.stringify(data.client));
    setClientToken(data.token);

    const s: AuthSession = { kind: 'client', userId: data.client.id, client: data.client as Client, role: null, permissions: CLIENT_PERMS };
    setSession(s);
    setPermissions(CLIENT_PERMS);
    return s;
  };

  const clientActivate = async (phone: string, activationPin: string, newPin: string, confirmPin: string): Promise<AuthSession> => {
    await supabase.auth.signOut();
    const resp = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ action: 'activate', phone_number: phone, activation_pin: activationPin, new_pin: newPin, confirm_pin: confirmPin }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error ?? 'تعذر التفعيل');

    sessionStorage.set(CLIENT_TOKEN_KEY, data.token);
    sessionStorage.set(CLIENT_SESSION_KEY, JSON.stringify(data.client));
    setClientToken(data.token);

    const s: AuthSession = { kind: 'client', userId: data.client.id, client: data.client as Client, role: null, permissions: CLIENT_PERMS };
    setSession(s);
    setPermissions(CLIENT_PERMS);
    return s;
  };

  const clientCheckStatus = async (phone: string): Promise<{ needs_activation: boolean }> => {
    const resp = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ action: 'check_status', phone_number: phone }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error ?? 'تعذر التحقق');
    return { needs_activation: data.needs_activation };
  };

  const clientChangePin = async (clientId: string, currentPin: string, newPin: string, confirmPin: string): Promise<void> => {
    const resp = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ action: 'change_pin', client_id: clientId, current_pin: currentPin, new_pin: newPin, confirm_pin: confirmPin }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error ?? 'تعذر تغيير رمز PIN');

    if (data.token) {
      sessionStorage.set(CLIENT_TOKEN_KEY, data.token);
      setClientToken(data.token);
    }
  };

  const clientLogout = async () => {
    const token = sessionStorage.get(CLIENT_TOKEN_KEY);
    if (token) {
      try {
        await fetch(AUTH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ action: 'logout', token }),
        });
      } catch { /* */ }
    }
    sessionStorage.remove(CLIENT_TOKEN_KEY);
    sessionStorage.remove(CLIENT_SESSION_KEY);
    setClientToken(null);
    setSession(null);
    setPermissions([]);
  };

  const logout = async () => {
    if (session?.kind === 'staff') {
      await authService.signOut();
      clearStaffSessionState();
    } else if (session?.kind === 'client') {
      await clientLogout();
      return;
    }
    setSession(null);
    setPermissions([]);
  };

  const hasPermission = (key: string): boolean => {
    if (!session) return false;
    if (session.kind === 'staff' && session.role?.key === 'super_admin') return true;
    if (session.kind === 'staff' && session.role?.key === 'field_employee' && key.startsWith('worker_')) return true;
    if (session.kind === 'client' && key.startsWith('client_')) return true;
    return permissions.includes(key);
  };

  return (
    <AuthContext.Provider value={{ session, permissions, loading, staffLogin, clientLogin, clientActivate, clientCheckStatus, clientChangePin, clientLogout, logout, refresh, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
