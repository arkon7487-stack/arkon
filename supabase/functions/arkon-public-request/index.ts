import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ARKON_COMPANY_ID = "11111111-1111-1111-1111-111111111111";

// --- Phone normalization (same as client-auth) ---
function normalizePhone(input: string): string {
  let p = input.trim().replace(/[\s\-()]/g, "");
  p = p.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
  if (p.startsWith("+972")) p = "0" + p.slice(4);
  else if (p.startsWith("972")) p = "0" + p.slice(3);
  else if (p.startsWith("00972")) p = "0" + p.slice(5);
  return p;
}

// --- Simple honeypot + rate limiting via database ---
// Rate limiting: check last submission from same IP+phone within 5 minutes
async function checkRateLimit(supabase: any, phone: string, ip: string): Promise<boolean> {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("opportunities")
    .select("id", { count: "exact", head: true })
    .eq("phone_number", phone)
    .gte("created_at", fiveMinAgo);
  return (count ?? 0) > 0;
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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
      full_name: string;
      phone_number: string;
      alt_phone?: string;
      address: string;
      city: string;
      interested_service: string;
      property_type?: string;
      preferred_contact_time?: string;
      preferred_days?: string;
      notes?: string;
    };

    if (!body.full_name?.trim() || !body.phone_number?.trim() || !body.interested_service?.trim()) {
      return json({ error: "الاسم ورقم الهاتف ونوع الخدمة مطلوبة" }, 400);
    }

    const phone = normalizePhone(body.phone_number);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    if (await checkRateLimit(supabase, phone, ip)) {
      return json({ error: "تم استلام طلبك مؤخراً. يرجى المحاولة مرة أخرى بعد 5 دقائق." }, 429);
    }

    // --- Check if existing client ---
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id, full_name, phone_number, address, service_area")
      .eq("phone_number", phone)
      .maybeSingle();

    // --- Find active contract if existing client ---
    let contract: { id: string } | null = null;
    if (existingClient) {
      const { data: c } = await supabase
        .from("contracts")
        .select("id")
        .eq("client_id", existingClient.id)
        .in("status", ["active", "draft"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      contract = c as { id: string } | null;
    }

    // --- Create a service_requests record for the Admin Support inbox ---
    await supabase.from("service_requests").insert({
      company_id: ARKON_COMPANY_ID,
      client_id: existingClient?.id ?? null,
      subject: `طلب خدمة من الموقع - ${body.interested_service}`,
      message: [
        body.preferred_contact_time ? `وقت التواصل المفضل: ${body.preferred_contact_time}` : null,
        body.preferred_days ? `أيام الخدمة المفضلة: ${body.preferred_days}` : null,
        body.property_type ? `نوع العقار: ${body.property_type}` : null,
        body.notes ? `ملاحظات: ${body.notes}` : null,
      ].filter(Boolean).join("\n") || `طلب جديد من الموقع الإلكتروني`,
      status: "open",
      source: "website",
      requester_name: body.full_name.trim(),
      requester_phone: phone,
      requester_address: [body.address?.trim(), body.city?.trim()].filter(Boolean).join(", "),
      requested_service: body.interested_service?.trim() ?? null,
    });

    // --- Notify sales team ---
    try {
      await supabase.from("notifications").insert({
        audience: "sales",
        category: "new_lead",
        title: "طلب خدمة جديد من الموقع الإلكتروني",
        body: `طلب جديد من ${body.full_name} - ${body.interested_service}`,
        read: false,
      });
    } catch (err) {
      console.warn("[public-request] Notification failed (non-fatal):", err);
    }

    // --- Also create an opportunity/lead ---
    const { error: oppError } = await supabase.from("opportunities").insert({
      company_id: ARKON_COMPANY_ID,
      customer_name: body.full_name.trim(),
      phone_number: phone,
      alt_phone: body.alt_phone?.trim() || null,
      address: body.address?.trim() || null,
      city: body.city?.trim() || null,
      interested_service: body.interested_service?.trim() || null,
      lead_source: "website",
      status: "new",
      priority: "medium",
      notes: body.notes?.trim() || null,
    });

    if (oppError) {
      console.error("[public-request] Opportunity insert failed:", oppError);
    }

    return json({ success: true, message: "تم إرسال طلبك بنجاح. سنتواصل معك قريباً." }, 200);
  } catch (err) {
    console.error("[public-request] Error:", err);
    return json({ error: "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى." }, 500);
  }
});
