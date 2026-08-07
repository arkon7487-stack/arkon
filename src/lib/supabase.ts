import { createClient } from '@supabase/supabase-js';
import { sessionStorage } from '@/lib/sessionStorage';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// --- Client Portal token management ---
// The Customer Portal authenticates via a custom token (not Supabase Auth).
// We inject it as an `x-client-token` header on every Supabase request so that
// the RLS function `get_client_id_from_token()` can resolve the logged-in client.
let clientToken: string | null = sessionStorage.get('arkon_client_token');

export function setClientToken(token: string | null) {
  clientToken = token;
}

function supabaseFetch(url: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  if (clientToken) {
    const headers = new Headers(init.headers);
    headers.set('x-client-token', clientToken);
    init.headers = headers;
  }
  return fetch(url, init);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: supabaseFetch,
  },
});

export const ARKON_COMPANY_ID = '11111111-1111-1111-1111-111111111111';
