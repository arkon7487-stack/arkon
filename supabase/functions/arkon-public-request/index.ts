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
      preferred_contact_time?: string;
      preferred_days?: string;
      property_type?: string;
      notes?: string;
      // Honeypot — must be empty
      website?: string;
    };

    // --- Honeypot check ---
    if (body.website && body.website.trim() !== "") {
      return json({ success: true }, 200); // Pretend success to fool bots
    }

    // --- Validation ---
    if (!body.full_name?.trim()) return json({ error: "الاسم الكامل مطلوب" }, 400);
    if (!body.phone_number?.trim()) return json({ error: "رقم الهاتف مطلوب" }, 400);
    if (!body.address?.trim()) return json({ error: "العنوان مطلوب" }, 400);
    if (!body.city?.trim()) return json({ error: "المدينة مطلوبة" }, 400);
    if (!body.interested_service?.trim()) return json({ error: "نوع الخدمة مطلوب" }, 400);

    const phone = normalizePhone(body.phone_number);

    // --- Rate limiting ---
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rateLimited = await checkRateLimit(supabase, phone, ip);
    if (rateLimited) {
      return json({ error: "تم إرسال طلبك مسبقاً. يرجى المحاولة لاحقاً." }, 429);
    }

    // --- Duplicate prevention ---
    // 1. Check if an active client already exists with this phone
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id, full_name")
      .eq("phone_number", phone)
      .neq("status", "inactive")
      .maybeSingle();

    if (existingClient) {
      // Create a service request for the existing client instead of a new lead
      const { data: contract } = await supabase
        .from("contracts")
        .select("id")
        .eq("client_id", existingClient.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      await supabase.from("service_requests").insert({
        company_id: ARKON_COMPANY_ID,
        client_id: existingClient.id,
        contract_id: contract?.id ?? null,
        subject: `طلب خدمة من الموقع - ${body.interested_service}`,
        message: body.notes ?? `طلب جديد من العميل الحالي عبر الموقع الإلكتروني`,
        status: "open",
      });

      return json({
        success: true,
        message: "تم إرسال طلبك بنجاح. سيتواصل معك فريق ARKON قريبًا.",
        is_existing_customer: true,
      }, 200);
    }

    // 2. Check for existing open opportunity with same phone
    const { data: existingOpp } = await supabase
      .from("opportunities")
      .select("id, status, sales_lead_id")
      .eq("phone_number", phone)
      .in("status", ["new", "sent_to_sales", "contacted", "follow_up"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingOpp) {
      // Add a note to the existing opportunity instead of creating a duplicate
      await supabase
        .from("opportunities")
        .update({
          notes: `طلب جديد من الموقع بتاريخ ${new Date().toISOString()}. ${body.notes ?? ""}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingOpp.id);

      return json({
        success: true,
        message: "تم إرسال طلبك بنجاح. سيتواصل معك فريق ARKON قريبًا.",
        is_duplicate: true,
      }, 200);
    }

    // --- Create Opportunity ---
    const { data: opp, error: oppErr } = await supabase
      .from("opportunities")
      .insert({
        company_id: ARKON_COMPANY_ID,
        customer_name: body.full_name.trim(),
        phone_number: phone,
        alt_phone: body.alt_phone ? normalizePhone(body.alt_phone) : null,
        address: body.address.trim(),
        city: body.city.trim(),
        interested_service: body.interested_service.trim(),
        notes: [
          body.preferred_contact_time ? `وقت التواصل المفضل: ${body.preferred_contact_time}` : null,
          body.preferred_days ? `أيام الخدمة المفضلة: ${body.preferred_days}` : null,
          body.property_type ? `نوع العقار: ${body.property_type}` : null,
          body.notes ? `ملاحظات: ${body.notes}` : null,
        ].filter(Boolean).join("\n"),
        lead_source: "website",
        status: "new",
        priority: "medium",
      })
      .select("*")
      .maybeSingle();

    if (oppErr || !opp) {
      console.error("[public-request] Opportunity insert failed:", oppErr);
      return json({ error: "تعذر إرسال الطلب مؤقتًا، حاول مرة أخرى." }, 500);
    }

    // --- Create linked Sales Lead ---
    let salesLeadId: string | null = null;
    try {
      const { data: lead, error: leadErr } = await supabase
        .from("leads")
        .insert({
          company_id: ARKON_COMPANY_ID,
          full_name: body.full_name.trim(),
          phone_number: phone,
          alternate_phone: body.alt_phone ? normalizePhone(body.alt_phone) : null,
          address: body.address.trim(),
          area: body.city.trim(),
          lead_source: "website",
          interested_service: body.interested_service.trim(),
          notes: body.notes ?? null,
          stage: "new_lead",
          opportunity_id: opp.id,
        })
        .select("id")
        .maybeSingle();

      if (!leadErr && lead) {
        salesLeadId = lead.id;
        await supabase
          .from("opportunities")
          .update({
            sales_lead_id: lead.id,
            sent_to_sales_at: new Date().toISOString(),
            status: "sent_to_sales",
          })
          .eq("id", opp.id);
      }
    } catch (err) {
      console.warn("[public-request] Sales lead creation failed (non-fatal):", err);
      // Mark opportunity as pending_sales_sync
      await supabase
        .from("opportunities")
        .update({ notes: (opp.notes ?? "") + "\n[pending_sales_sync]" })
        .eq("id", opp.id);
    }

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

    return json({
      success: true,
      message: "تم إرسال طلبك بنجاح. سيتواصل معك فريق ARKON قريبًا.",
      opportunity_id: opp.id,
      sales_lead_id: salesLeadId,
    }, 200);
  } catch (err) {
    console.error("[public-request] Unhandled error:", err);
    return json({ error: "تعذر الاتصال بالخدمة، حاول لاحقًا." }, 500);
  }
});
