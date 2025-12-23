// supabase/functions/send-invoice/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function money(n: unknown) {
  const x = Number(n || 0);
  return x.toFixed(2);
}

function esc(s: unknown) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function nl2br(s: unknown) {
  return esc(s).replaceAll("\n", "<br/>");
}

function buildEmailHtml(args: {
  clinic: any;
  patient: any;
  invoice: any;
  items: any[];
}) {
  const { clinic, patient, invoice, items } = args;

  const clinicName = clinic?.clinic_name || "מרפאה";
  const doctorDisplay = `${clinic?.doctor_title ? clinic.doctor_title + " " : ""}${clinic?.doctor_name || ""}`.trim();
  const license = clinic?.license_number ? `רישיון: ${clinic.license_number}` : "";
  const business = clinic?.business_id ? `מס׳ עסק: ${clinic.business_id}` : "";
  const address = clinic?.clinic_address || "";
  const whatsapp = clinic?.whatsapp ? `וואטסאפ: ${clinic.whatsapp}` : "";
  const email = clinic?.email ? `אימייל: ${clinic.email}` : "";
  const hours = clinic?.clinic_hours ? `שעות פעילות: ${clinic.clinic_hours}` : "";

  const logoUrl = clinic?.logo_url || "";
  const signatureUrl = clinic?.signature_url || "";
  const footer = clinic?.invoice_footer || "";

  const invNum = invoice?.invoice_number || "";
  const invStatus = invoice?.status || "";
  const invTotal = `${money(invoice?.total)} ${invoice?.currency || "ILS"}`;
  const invDate = invoice?.created_at
    ? new Date(invoice.created_at).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })
    : "";

  const patientName = patient?.full_name || "";
  const patientEmail = patient?.email || "";
  const patientPhone = patient?.phone || "";

  const rows = items.map((it) => {
    const qty = Number(it?.qty || 0);
    const unit = Number(it?.unit_price || 0);
    const line = Number(it?.line_total ?? qty * unit);
    return `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #eee;">${esc(it?.description)}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">${esc(qty)}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;">${money(unit)}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;">${money(line)}</td>
      </tr>
    `;
  }).join("");

  return `
  <div style="direction:rtl;font-family:Arial,Helvetica,sans-serif;background:#f6f7fb;padding:24px;">
    <div style="max-width:720px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:14px;overflow:hidden;">
      
      <div style="padding:18px 18px 10px; border-bottom:1px solid #eee;">
        <div style="display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap;">
          <div>
            <div style="font-size:20px;font-weight:800;color:#111;">${esc(clinicName)}</div>
            ${doctorDisplay ? `<div style="margin-top:4px;color:#444;">${esc(doctorDisplay)}</div>` : ""}
            <div style="margin-top:6px;color:#666;font-size:13px;">
              ${[license, business].filter(Boolean).map(esc).join(" | ")}
            </div>
            <div style="margin-top:6px;color:#666;font-size:13px;">
              ${[address, whatsapp, email].filter(Boolean).map(esc).join(" | ")}
            </div>
            ${hours ? `<div style="margin-top:6px;color:#666;font-size:13px;">${esc(hours)}</div>` : ""}
          </div>

          ${logoUrl ? `
            <div style="min-width:120px;text-align:left;">
              <img src="${esc(logoUrl)}" alt="logo" style="max-height:52px;max-width:180px;object-fit:contain;" />
            </div>` : ""
          }
        </div>
      </div>

      <div style="padding:18px;">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div style="color:#222;">
            <div style="font-weight:800;font-size:18px;">חשבונית</div>
            <div style="margin-top:6px;color:#555;">מס׳: <strong>${esc(invNum)}</strong></div>
            <div style="margin-top:4px;color:#555;">תאריך: ${esc(invDate)}</div>
            <div style="margin-top:4px;color:#555;">סטטוס: ${esc(invStatus)}</div>
          </div>
          <div style="color:#222;text-align:left;">
            <div style="font-weight:800;">סה״כ לתשלום</div>
            <div style="margin-top:6px;font-size:22px;font-weight:900;">${esc(invTotal)}</div>
          </div>
        </div>

        <div style="margin-top:14px;padding:12px;border:1px solid #eee;border-radius:12px;background:#fafafa;">
          <div style="font-weight:800;">פרטי מטופל</div>
          <div style="margin-top:6px;color:#444;">${esc(patientName)}</div>
          <div style="margin-top:4px;color:#666;font-size:13px;">
            ${[patientEmail ? `אימייל: ${patientEmail}` : "", patientPhone ? `טלפון: ${patientPhone}` : ""].filter(Boolean).map(esc).join(" | ")}
          </div>
        </div>

        <div style="margin-top:14px;border:1px solid #eee;border-radius:12px;overflow:hidden;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f3f5fb;">
                <th style="padding:10px;text-align:right;border-bottom:1px solid #eee;">תיאור</th>
                <th style="padding:10px;text-align:center;border-bottom:1px solid #eee;">כמות</th>
                <th style="padding:10px;text-align:right;border-bottom:1px solid #eee;">מחיר יח׳</th>
                <th style="padding:10px;text-align:right;border-bottom:1px solid #eee;">סה״כ</th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="4" style="padding:12px;color:#666;">אין פריטים</td></tr>`}
            </tbody>
          </table>
        </div>

        <div style="margin-top:14px;display:flex;justify-content:flex-end;">
          <div style="min-width:260px;">
            <div style="display:flex;justify-content:space-between;color:#555;margin-top:6px;">
              <span>סה״כ</span><strong>${esc(invTotal)}</strong>
            </div>
          </div>
        </div>

        ${signatureUrl ? `
          <div style="margin-top:20px;display:flex;justify-content:flex-end;">
            <div style="text-align:right;">
              <div style="color:#555;font-size:13px;">חתימה</div>
              <img src="${esc(signatureUrl)}" alt="signature" style="margin-top:6px;max-height:70px;max-width:220px;object-fit:contain;" />
            </div>
          </div>` : ""
        }

        ${footer ? `
          <div style="margin-top:18px;padding-top:12px;border-top:1px solid #eee;color:#666;font-size:13px;line-height:1.5;">
            ${nl2br(footer)}
          </div>` : ""
        }
      </div>
    </div>

    <div style="max-width:720px;margin:10px auto 0;color:#8a8a8a;font-size:12px;text-align:center;">
      הודעה זו נשלחה אוטומטית ממערכת המרפאה.
    </div>
  </div>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { invoice_id } = await req.json();
    if (!invoice_id) throw new Error("Missing invoice_id");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY")!;
    if (!supabaseUrl || !serviceRoleKey || !resendKey) throw new Error("Missing env secrets");

    const sb = createClient(supabaseUrl, serviceRoleKey);

    // Load invoice
    const invRes = await sb
      .from("invoices")
      .select("*")
      .eq("id", invoice_id)
      .single();

    if (invRes.error) throw invRes.error;
    const invoice = invRes.data;

    // Load items
    const itemsRes = await sb
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoice_id)
      .order("created_at", { ascending: true });

    if (itemsRes.error) throw itemsRes.error;

    // Load patient
    const patRes = await sb
      .from("patients")
      .select("*")
      .eq("id", invoice.patient_id)
      .single();

    if (patRes.error) throw patRes.error;
    const patient = patRes.data;

    // Load clinic settings (latest row)
    const clinicRes = await sb
      .from("clinic_settings")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1);

    const clinic = clinicRes.data?.[0] || null;

    // Determine recipient
    const toEmail = invoice.sent_to_email || patient.email;
    if (!toEmail) throw new Error("No recipient email (patient.email or invoice.sent_to_email)");

    const html = buildEmailHtml({
      clinic,
      patient,
      invoice,
      items: itemsRes.data || [],
    });

    // Send via Resend
    const subject = `חשבונית ${invoice.invoice_number || ""} | ${clinic?.clinic_name || "מרפאה"}`.trim();

    const sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Clinic <onboarding@resend.dev>", // you can change after domain verification
        to: [toEmail],
        subject,
        html,
      }),
    });

    if (!sendRes.ok) {
      const t = await sendRes.text();
      throw new Error("Resend error: " + t);
    }

    // Mark sent
    const upd = await sb
      .from("invoices")
      .update({ status: "sent", sent_at: new Date().toISOString(), sent_to_email: toEmail })
      .eq("id", invoice_id);

    if (upd.error) throw upd.error;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
