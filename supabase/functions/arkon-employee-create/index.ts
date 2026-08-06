import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ARKON_COMPANY_ID = "11111111-1111-1111-1111-111111111111";

interface CreateEmployeeBody {
  full_name: string;
  phone_number: string;
  national_id?: string;
  age?: number;
  gender?: string;
  address?: string;
  service_area?: string;
  employment_date?: string;
  department?: string;
  position?: string;
  working_hours?: string;
  employment_status?: string;
  photo_url?: string;
  emergency_contact?: string;
  username?: string;
  auth_email?: string;
  password?: string;
  role_key?: string;
  monthly_salary?: number;
  salary_type?: string;
  salary_effective_date?: string;
  salary_notes?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // JWT verification — only authenticated admins can create employees
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return json({ error: "غير مصرح" }, 401);
    }
    const jwt = authHeader.replace("Bearer ", "");

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: userData, error: userErr } = await authClient.auth.getUser(jwt);
    if (userErr || !userData.user) {
      return json({ error: "غير مصرح" }, 401);
    }

    // Verify the caller is an admin
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role:roles(key)")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    const callerRoleKey = (callerProfile as any)?.role?.key;
    if (!["super_admin", "admin", "manager"].includes(callerRoleKey)) {
      return json({ error: "غير مصرح: لا تملك صلاحية إنشاء موظفين" }, 403);
    }

    let body: CreateEmployeeBody;
    try {
      body = (await req.json()) as CreateEmployeeBody;
    } catch {
      return json({ error: "طلب غير صالح: يجب أن يكون الجسم بتنسيق JSON" }, 400);
    }

    if (!body.full_name?.trim()) {
      return json({ error: "الاسم الكامل مطلوب" }, 400);
    }
    if (!body.phone_number?.trim()) {
      return json({ error: "رقم الهاتف مطلوب" }, 400);
    }

    // Check for duplicate phone number
    const { data: existingPhone } = await supabase
      .from("employees")
      .select("id")
      .eq("phone_number", body.phone_number.trim())
      .maybeSingle();
    if (existingPhone) {
      return json({ error: "رقم الهاتف مستخدم بالفعل من قِبل موظف آخر" }, 400);
    }

    // Build a safe ASCII base from the provided username or full_name
    const rawUsername = (body.username?.trim() || body.full_name)
      .toLowerCase()
      .replace(/[\u0600-\u06FF]/g, (c) => translitAr(c))
      .replace(/[^a-z0-9]/g, ".")
      .replace(/\.{2,}/g, ".")
      .replace(/^\.|\.$/g, "");

    // Always append a short random suffix so no two employees ever collide
    const suffix = Math.random().toString(36).slice(2, 6);
    const finalUsername = `${rawUsername || "emp"}.${suffix}`;

    const email = body.auth_email?.trim() || `${finalUsername}@arkon.enterprise`;
    const tempPassword = body.password?.trim() || generateTempPassword();
    const roleKey = body.role_key?.trim() || "field_employee";
    const jobTitle = body.position?.trim() || null;

    // Check for duplicate auth_email before creating auth user
    if (body.auth_email?.trim()) {
      const { data: existingEmail } = await supabase
        .from("employees")
        .select("id")
        .eq("auth_email", body.auth_email.trim())
        .maybeSingle();
      if (existingEmail) {
        return json({ error: "البريد الإلكتروني مستخدم بالفعل من قِبل موظف آخر" }, 400);
      }
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: body.full_name, source: "arkon_employee" },
    });
    if (authError) {
      const msg = authError.message.includes("already been registered")
        ? "البريد الإلكتروني مستخدم بالفعل في نظام المصادقة"
        : `فشل إنشاء حساب المصادقة: ${authError.message}`;
      return json({ error: msg }, 400);
    }
    const userId = authData.user.id;

    // Insert employee record
    const { data: empData, error: empError } = await supabase
      .from("employees")
      .insert({
        company_id: ARKON_COMPANY_ID,
        full_name: body.full_name.trim(),
        phone_number: body.phone_number.trim(),
        national_id: body.national_id?.trim() || null,
        age: body.age ?? null,
        gender: body.gender || null,
        address: body.address?.trim() || null,
        service_area: body.service_area?.trim() || null,
        employment_date: body.employment_date || null,
        department: body.department?.trim() || null,
        position: jobTitle,
        job_title: jobTitle,
        working_hours: body.working_hours?.trim() || null,
        employment_status: body.employment_status || "active",
        photo_url: body.photo_url?.trim() || null,
        emergency_contact: body.emergency_contact?.trim() || null,
        username: finalUsername,
        auth_email: email,
        monthly_salary: body.monthly_salary != null ? Number(body.monthly_salary) : null,
        salary_type: body.salary_type || "monthly",
        salary_effective_date: body.salary_effective_date || null,
        salary_notes: body.salary_notes?.trim() || null,
      })
      .select("*")
      .maybeSingle();

    if (empError || !empData) {
      // Rollback: delete the just-created auth user
      await supabase.auth.admin.deleteUser(userId);
      const msg = empError?.message.includes("unique")
        ? "رقم الهاتف أو البريد الإلكتروني مستخدم بالفعل"
        : `فشل إنشاء سجل الموظف: ${empError?.message ?? "خطأ غير معروف"}`;
      return json({ error: msg }, 400);
    }

    const employee = empData;

    // Assign role via profiles
    const { data: roleData } = await supabase
      .from("roles")
      .select("id")
      .eq("key", roleKey)
      .maybeSingle();

    if (roleData) {
      const { error: profileError } = await supabase.from("profiles").insert({
        user_id: userId,
        role_id: roleData.id,
        employee_id: employee.id,
        display_name: body.full_name.trim(),
      });
      if (profileError) {
        // Non-fatal: employee and auth account are created. Log the issue.
        console.error("Profile insert failed (non-fatal):", profileError.message);
      }
    } else {
      console.error(`Role not found for key: ${roleKey} — profile not created`);
    }

    // Log activity (best-effort, never blocks creation)
    await supabase.from("activity_timeline").insert({
      entity_type: "employee",
      entity_id: employee.id,
      event_type: "employee_created",
      message: `تم إنشاء موظف جديد: ${body.full_name}`,
    }).then(({ error }) => {
      if (error) console.error("Activity log failed (non-fatal):", error.message);
    });

    return json(
      { employee, temp_password: tempPassword, auth_email: email, user_id: userId },
      200,
    );
  } catch (err) {
    console.error("Unhandled error in arkon-employee-create:", (err as Error).message);
    return json({ error: `خطأ داخلي في الخادم: ${(err as Error).message}` }, 500);
  }
});

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return `Ark${out}!1`;
}

// Minimal Arabic → Latin transliteration for username generation
const AR_MAP: Record<string, string> = {
  "ا": "a", "أ": "a", "إ": "i", "آ": "a", "ب": "b", "ت": "t", "ث": "th",
  "ج": "j", "ح": "h", "خ": "kh", "د": "d", "ذ": "z", "ر": "r", "ز": "z",
  "س": "s", "ش": "sh", "ص": "s", "ض": "d", "ط": "t", "ظ": "z", "ع": "a",
  "غ": "gh", "ف": "f", "ق": "q", "ك": "k", "ل": "l", "م": "m", "ن": "n",
  "ه": "h", "و": "w", "ي": "y", "ى": "a", "ة": "a", "ء": "a", "ئ": "y",
  "ؤ": "w", " ": ".",
};

function translitAr(char: string): string {
  return AR_MAP[char] ?? "";
}
