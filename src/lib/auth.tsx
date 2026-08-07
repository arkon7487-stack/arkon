import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase, setClientToken } from '@/lib/supabase';
import { authService } from '@/services/authService';
import { permissionService } from '@/services/permissionService';
import type { AuthSession, Client } from '@/types';

const CLIENT_TOKEN_KEY = 'arkon_client_token';
const CLIENT_SESSION_KEY = 'arkon_client_session';

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

async function loadStaffSession(): Promise<{ session: AuthSession; permissions: string[] } | null> {
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return null;
  const profile = await authService.getCurrentProfile();
  if (!profile) return null;
  let perms: string[] = [];
  try {
    perms = profile.role?.id ? await permissionService.getForRole(profile.role.id) : [];
  } catch {
    // RLS may block permission lookup for non-admin roles — don't let this break login
  }
  return {
    session: { kind: 'staff', userId, profile, role: profile?.role ?? null, permissions: perms },
    permissions: perms,
  };
}

async function loadClientSession(): Promise<{ session: AuthSession; permissions: string[] } | null> {
  const token = localStorage.getItem(CLIENT_TOKEN_KEY);
  if (!token) return null;

  try {
    const resp = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ action: 'validate_session', token }),
    });
    if (!resp.ok) { localStorage.removeItem(CLIENT_TOKEN_KEY); localStorage.removeItem(CLIENT_SESSION_KEY); return null; }
    const data = await resp.json();
    if (!data.valid) { localStorage.removeItem(CLIENT_TOKEN_KEY); localStorage.removeItem(CLIENT_SESSION_KEY); setClientToken(null); return null; }

    setClientToken(token);
    const client = data.client as Client;
    localStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(client));
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
          const profile = await authService.getCurrentProfile();
          if (profile) {
            const perms = profile.role?.id ? await permissionService.getForRole(profile.role.id) : [];
            setSession({ kind: 'staff', userId: supaSession.user.id, profile, role: profile?.role ?? null, permissions: perms });
            setPermissions(perms);
          }
        }
      })();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const staffLogin = async (email: string, password: string): Promise<AuthSession> => {
    localStorage.removeItem(CLIENT_TOKEN_KEY);
    localStorage.removeItem(CLIENT_SESSION_KEY);
    setClientToken(null);
    const { profile, role } = await authService.signInWithPassword(email, password);
    const perms = profile?.role?.id ? await permissionService.getForRole(profile.role.id) : [];
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

    localStorage.setItem(CLIENT_TOKEN_KEY, data.token);
    localStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(data.client));
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

    localStorage.setItem(CLIENT_TOKEN_KEY, data.token);
    localStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(data.client));
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

    // Update token if returned
    if (data.token) {
      localStorage.setItem(CLIENT_TOKEN_KEY, data.token);
      setClientToken(data.token);
    }
  };

  const clientLogout = async () => {
    const token = localStorage.getItem(CLIENT_TOKEN_KEY);
    if (token) {
      try {
        await fetch(AUTH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ action: 'logout', token }),
        });
      } catch { /* */ }
    }
    localStorage.removeItem(CLIENT_TOKEN_KEY);
    localStorage.removeItem(CLIENT_SESSION_KEY);
    setClientToken(null);
    setSession(null);
    setPermissions([]);
  };

  const logout = async () => {
    if (session?.kind === 'staff') {
      await authService.signOut();
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
