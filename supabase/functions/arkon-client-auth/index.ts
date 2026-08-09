import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const SESSION_HOURS = 12;
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;

// ── Phone normalization ──────────────────────────────────────────
function normalizePhone(input: string): string {
  let p = input.trim().replace(/[\s\-()]/g, "");
  // Convert Arabic-Indic digits to English
  p = p.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
  if (p.startsWith("+972")) p = "0" + p.slice(4);
  else if (p.startsWith("972")) p = "0" + p.slice(3);
  else if (p.startsWith("00972")) p = "0" + p.slice(5);
  return p;
}

// ── PIN / code validation ────────────────────────────────────────
function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

// ── PBKDF2 hashing (server-side only) ────────────────────────────
async function pbkdf2Hash(input: string, saltHex: string, iterations: number): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(input),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const saltBytes = new Uint8Array(
    saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)),
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  return Array.from(new Uint8Array(derived))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateSalt(): string {
  const arr = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashSecret(input: string): Promise<{ hash: string; salt: string }> {
  const salt = generateSalt();
  const hash = await pbkdf2Hash(input, salt, PBKDF2_ITERATIONS);
  return { hash, salt };
}

// ── Generic JSON response helper ──────────────────────────────────
function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const GENERIC_ERROR = "تعذر تسجيل الدخول. تحقق من رقم الهاتف ورمز PIN.";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const body = (await req.json()) as {
      action: string;
      phone_number?: string;
      pin?: string;
      activation_pin?: string;
      new_pin?: string;
      confirm_pin?: string;
      current_pin?: string;
      token?: string;
      client_id?: string;
    };

    const action = body.action;

    // ── ACTION: login ─────────────────────────────────────────────
    if (action === "login") {
      if (!body.phone_number || !body.pin) return json({ error: GENERIC_ERROR }, 400);
      if (!isValidPin(body.pin)) return json({ error: GENERIC_ERROR }, 400);

      const phone = normalizePhone(body.phone_number);

      const { data: client } = await supabase
        .from("clients")
        .select("id, full_name, phone_number, email, address, service_area, status, company_id")
        .eq("phone_number", phone)
        .maybeSingle();

      if (!client || client.status === "inactive") return json({ error: GENERIC_ERROR }, 401);

      const { data: pinRow } = await supabase
        .from("client_pins")
        .select("*")
        .eq("client_id", client.id)
        .maybeSingle();

      if (!pinRow) return json({ error: GENERIC_ERROR }, 401);

      // Check lockout
      if (pinRow.locked_until && new Date(pinRow.locked_until).getTime() > Date.now()) {
        return json({ error: "تم قفل الحساب مؤقتاً بسبب محاولات خاطئة متكررة. حاول لاحقاً." }, 429);
      }

      const computedHash = await pbkdf2Hash(body.pin, pinRow.pin_salt, pinRow.pin_iterations);
      if (computedHash !== pinRow.pin_hash) {
        const newAttempts = pinRow.failed_attempts + 1;
        const shouldLock = newAttempts >= MAX_FAILED_ATTEMPTS;
        await supabase
          .from("client_pins")
          .update({
            failed_attempts: shouldLock ? 0 : newAttempts,
            locked_until: shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString() : pinRow.locked_until,
          })
          .eq("client_id", client.id);
        return json({ error: GENERIC_ERROR }, 401);
      }

      // Success — reset failed attempts, create session
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();

      await supabase
        .from("client_pins")
        .update({ failed_attempts: 0, locked_until: null, last_login_at: new Date().toISOString() })
        .eq("client_id", client.id);

      await supabase.from("client_sessions").insert({
        client_id: client.id,
        token,
        expires_at: expiresAt,
      });

      return json({ client, token, expires_at: expiresAt }, 200);
    }

    // ── ACTION: activate (first-time PIN setup) ───────────────────
    if (action === "activate") {
      if (!body.phone_number || !body.activation_pin || !body.new_pin || !body.confirm_pin) {
        return json({ error: "جميع الحقول مطلوبة" }, 400);
      }
      if (!isValidPin(body.new_pin)) return json({ error: "رمز PIN يجب أن يكون 4 أرقام" }, 400);
      if (body.new_pin !== body.confirm_pin) return json({ error: "رمزا PIN غير متطابقين" }, 400);

      const phone = normalizePhone(body.phone_number);

      const { data: client } = await supabase
        .from("clients")
        .select("id, full_name, phone_number, email, address, service_area, status, company_id")
        .eq("phone_number", phone)
        .maybeSingle();

      if (!client || client.status === "inactive") return json({ error: GENERIC_ERROR }, 401);

      // Check if PIN already exists
      const { data: existingPin } = await supabase
        .from("client_pins")
        .select("client_id")
        .eq("client_id", client.id)
        .maybeSingle();
      if (existingPin) return json({ error: "تم تفعيل حسابك مسبقاً. سجل الدخول برمز PIN." }, 400);

      // Validate activation code
      const { data: codes } = await supabase
        .from("client_activation_codes")
        .select("*")
        .eq("client_id", client.id)
        .is("used_at", null)
        .order("created_at", { ascending: false })
        .limit(1);

      const code = codes?.[0];
      if (!code) return json({ error: GENERIC_ERROR }, 401);
      if (new Date(code.expires_at).getTime() < Date.now()) {
        return json({ error: "انتهت صلاحية رمز التفعيل. تواصل مع الإدارة." }, 401);
      }

      const computedHash = await pbkdf2Hash(body.activation_pin, code.code_salt, PBKDF2_ITERATIONS);
      if (computedHash !== code.code_hash) return json({ error: GENERIC_ERROR }, 401);

      // Mark activation code as used
      await supabase
        .from("client_activation_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("id", code.id);

      // Create PIN
      const { hash, salt } = await hashSecret(body.new_pin);
      await supabase.from("client_pins").insert({
        client_id: client.id,
        pin_hash: hash,
        pin_salt: salt,
        pin_iterations: PBKDF2_ITERATIONS,
        failed_attempts: 0,
      });

      // Create session
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
      await supabase.from("client_sessions").insert({
        client_id: client.id,
        token,
        expires_at: expiresAt,
      });

      return json({ client, token, expires_at: expiresAt }, 200);
    }

    // ── ACTION: check_status (does client need activation?) ────────
    if (action === "check_status") {
      if (!body.phone_number) return json({ error: "phone_number required" }, 400);
      const phone = normalizePhone(body.phone_number);

      const { data: client } = await supabase
        .from("clients")
        .select("id, status")
        .eq("phone_number", phone)
        .maybeSingle();

      if (!client || client.status === "inactive") return json({ error: GENERIC_ERROR }, 401);

      const { data: pinRow } = await supabase
        .from("client_pins")
        .select("client_id")
        .eq("client_id", client.id)
        .maybeSingle();

      return json({ needs_activation: !pinRow }, 200);
    }

    // ── ACTION: validate_session ──────────────────────────────────
    if (action === "validate_session") {
      if (!body.token) return json({ valid: false }, 400);

      const { data: session } = await supabase
        .from("client_sessions")
        .select("client_id, expires_at, revoked")
        .eq("token", body.token)
        .maybeSingle();

      if (!session || session.revoked) return json({ valid: false }, 200);
      if (new Date(session.expires_at).getTime() < Date.now()) return json({ valid: false }, 200);

      const { data: client } = await supabase
        .from("clients")
        .select("id, full_name, phone_number, email, address, service_area, status, company_id")
        .eq("id", session.client_id)
        .maybeSingle();

      if (!client || client.status === "inactive") return json({ valid: false }, 200);

      return json({ valid: true, client }, 200);
    }

    // ── ACTION: logout (revoke session) ───────────────────────────
    if (action === "logout") {
      if (!body.token) return json({ success: true }, 200);

      await supabase
        .from("client_sessions")
        .update({ revoked: true })
        .eq("token", body.token);

      return json({ success: true }, 200);
    }

    // ── ACTION: change_pin (while logged in) ──────────────────────
    if (action === "change_pin") {
      if (!body.client_id || !body.current_pin || !body.new_pin || !body.confirm_pin) {
        return json({ error: "جميع الحقول مطلوبة" }, 400);
      }
      if (!isValidPin(body.new_pin)) return json({ error: "رمز PIN الجديد يجب أن يكون 4 أرقام" }, 400);
      if (body.new_pin !== body.confirm_pin) return json({ error: "رمزا PIN الجديد غير متطابقين" }, 400);

      const { data: pinRow } = await supabase
        .from("client_pins")
        .select("*")
        .eq("client_id", body.client_id)
        .maybeSingle();

      if (!pinRow) return json({ error: GENERIC_ERROR }, 401);

      const computedHash = await pbkdf2Hash(body.current_pin, pinRow.pin_salt, pinRow.pin_iterations);
      if (computedHash !== pinRow.pin_hash) return json({ error: "رمز PIN الحالي غير صحيح" }, 401);

      const { hash, salt } = await hashSecret(body.new_pin);
      await supabase
        .from("client_pins")
        .update({
          pin_hash: hash,
          pin_salt: salt,
          pin_updated_at: new Date().toISOString(),
          failed_attempts: 0,
          locked_until: null,
        })
        .eq("client_id", body.client_id);

      // Revoke all existing sessions for this client
      await supabase
        .from("client_sessions")
        .update({ revoked: true })
        .eq("client_id", body.client_id);

      // Create new session
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
      await supabase.from("client_sessions").insert({
        client_id: body.client_id,
        token,
        expires_at: expiresAt,
      });

      return json({ token, expires_at: expiresAt }, 200);
    }

    // ── ACTION: admin_reset_pin (admin generates new activation code) ─
    if (action === "admin_reset_pin") {
      if (!body.client_id) return json({ error: "client_id required" }, 400);

      // Invalidate existing PIN
      await supabase
        .from("client_pins")
        .delete()
        .eq("client_id", body.client_id);

      // Revoke all sessions
      await supabase
        .from("client_sessions")
        .update({ revoked: true })
        .eq("client_id", body.client_id);

      // Generate activation code (6 digits)
      const activationCode = String(Math.floor(100000 + Math.random() * 900000));
      const { hash, salt } = await hashSecret(activationCode);

      await supabase.from("client_activation_codes").insert({
        client_id: body.client_id,
        code_hash: hash,
        code_salt: salt,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        created_by: body.created_by ?? "admin",
      });

      return json({ activation_code: activationCode, expires_in_hours: 24 }, 200);
    }

    // ── ACTION: admin_generate_activation (for new customers) ──────
    if (action === "admin_generate_activation") {
      if (!body.client_id) return json({ error: "client_id required" }, 400);

      // Check if PIN already exists
      const { data: existingPin } = await supabase
        .from("client_pins")
        .select("client_id")
        .eq("client_id", body.client_id)
        .maybeSingle();
      if (existingPin) return json({ error: "هذا العميل لديه رمز PIN بالفعل" }, 400);

      const activationCode = String(Math.floor(100000 + Math.random() * 900000));
      const { hash, salt } = await hashSecret(activationCode);

      await supabase.from("client_activation_codes").insert({
        client_id: body.client_id,
        code_hash: hash,
        code_salt: salt,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        created_by: body.created_by ?? "admin",
      });

      return json({ activation_code: activationCode, expires_in_hours: 24 }, 200);
    }

    return json({ error: "Unknown action." }, 400);
  } catch (err) {
    console.error("[arkon-client-auth] Unhandled error:", err);
    return json({ error: "تعذر الاتصال بالخدمة، حاول لاحقًا." }, 500);
  }
});
