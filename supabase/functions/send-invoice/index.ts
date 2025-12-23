// supabase/functions/send-invoice/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

function money(n: number) {
  return Number(n || 0).toFixed(2);
}

function htmlEscape(s: string) {
  return (s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

serve(async (req) => {
  try {
    const { invoice_id } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
    const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!invoice_id) return new Response("Missing invoice_id", { status: 400 });
    if (!RESEND_API_KEY || !EMAIL_FROM) return new Response("Missing Resend secrets", { status: 500 });

    // Service role client (server-side only)
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Load invoice + patient + items
    const { data: inv, error: invErr } = await sb
      .from("invoices")
      .select("id, invoice_number, status, currency, subtotal, tax, total, sent_to_email, patient_id, created_at")
      .eq("id", invoice_id)
      .single();

    if (invErr) return new Response(invErr.message, { status: 500 });

    const { data: pat, error: patErr } = await sb
      .from("patients")
      .select("full_name, email")
      .eq("id", inv.patient_id)
      .single();

    if (patErr) return new Response(patErr.message, { status: 500 });

    const { data: items, error: itemsErr } = await sb
      .from("invoice_items")
      .select("description, qty, unit_price, line_total")
      .eq("invoice_id", invoice_id);

    if (itemsErr) return new Response(itemsErr.message, { status: 500 });

    const toEmail = inv.sent_to_email || pat.email;
    if (!toEmail) return new Response("No recipient email", { status: 400 });

    // Build a simple HTML invoice (Resend supports HTML directly)
    const rows = (items || []).map(it => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${htmlEscape(it.description)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${it.qty}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${money(it.unit_price)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${money(it.line_total)}</td>
      </tr>
    `).join("");

    const html = `
      <div style="font-family:Arial,sans-serif;direction:rtl;text-align:right;">
        <h2>חשבונית ${inv.invoice_number}</h2>
        <p><strong>לכבוד:</strong> ${htmlEscape(pat.full_name || "")}</p>
        <p><strong>תאריך:</strong> ${new Date(inv.created_at).toLocaleString("he-IL")}</p>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="padding:8px;border-bottom:2px solid #ddd;text-align:right;">תיאור</th>
              <th style="padding:8px;border-bottom:2px solid #ddd;text-align:right;">כמות</th>
              <th style="padding:8px;border-bottom:2px solid #ddd;text-align:right;">מחיר</th>
              <th style="padding:8px;border-bottom:2px solid #ddd;text-align:right;">סה״כ</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin-top:12px;"><strong>Subtotal:</strong> ${money(inv.subtotal)} ${inv.currency}</p>
        <p><strong>Total:</strong> ${money(inv.total)} ${inv.currency}</p>
        <p style="margin-top:18px;color:#666;">תודה רבה ובריאות שלמה.</p>
      </div>
    `;

    // Send email via Resend
    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [toEmail],
        subject: `Invoice ${inv.invoice_number}`,
        html
      }),
    });

    if (!resendResp.ok) {
      const errText = await resendResp.text();
      return new Response(`Resend error: ${errText}`, { status: 500 });
    }

    // Update invoice status
    await sb.from("invoices").update({
      status: "sent",
      sent_to_email: toEmail,
      sent_at: new Date().toISOString(),
    }).eq("id", invoice_id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
});
