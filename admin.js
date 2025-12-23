// admin.js — Clinic dashboard + sidebar + clinic_settings

window.__ADMIN_LOADED = true;
console.log("[ADMIN] admin.js loaded ✅");

const TABLE = "appointments";
let sb = null;

let allAppointments = [];
let lastVisitByPatient = new Map();
let lastInvoiceByPatient = new Map();
let clinic = null;

// ---------- helpers ----------
function $(id) { return document.getElementById(id); }
function on(id, event, handler) {
  const el = $(id);
  if (!el) return false;
  el.addEventListener(event, handler);
  return true;
}
function show(id, yes) { const el = $(id); if (el) el.style.display = yes ? "" : "none"; }
function setLoginError(msg) {
  const el = $("loginError");
  if (!el) return;
  el.textContent = msg || "";
  el.style.display = msg ? "" : "none";
}
function fmtDate(iso) {
  try { return new Date(iso).toLocaleString("he-IL", { dateStyle:"short", timeStyle:"short" }); }
  catch { return iso || ""; }
}
function todayIso() { return new Date().toISOString().slice(0, 10); }
function firstLine(s) {
  const txt = String(s || "").trim();
  if (!txt) return "";
  return txt.split("\n")[0].slice(0, 140);
}
function serviceLabel(value) {
  const map = {
    general: "ייעוץ רפואי כללי",
    "home-visit": "ביקור בית",
    chronic: "ניהול מחלות כרוניות",
    preventive: "רפואה מונעת",
    pediatric: "טיפול ילדים",
  };
  return map[value] || value || "";
}

// ---------- clinic settings ----------
async function loadClinicSettings() {
  const { data, error } = await sb
    .from("clinic_settings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) throw error;

  clinic = data?.[0] || null;

  const doctorDisplay =
    (clinic?.doctor_title ? clinic.doctor_title + " " : "") +
    (clinic?.doctor_name || "");

  const clinicDisplay = clinic?.clinic_name || "—";
  const licenseDisplay = clinic?.license_number ? `רישיון: ${clinic.license_number}` : "";

  const sideDoctor = $("sideDoctorName");
  if (sideDoctor) sideDoctor.textContent = doctorDisplay || "פרופיל רופא";

  const sideMeta = $("sideClinicMeta");
  if (sideMeta) sideMeta.textContent = `${clinicDisplay}${licenseDisplay ? " | " + licenseDisplay : ""}`;

  const sub = $("clinicSub");
  if (sub) sub.textContent = `${clinicDisplay}${doctorDisplay ? " | " + doctorDisplay : ""}`;

  // Links (fallbacks)
  const calendarUrl = clinic?.calendar_url || "https://calendar.google.com/";
  const accountingUrl = clinic?.accounting_url || "./accounting.html";

  const cal = $("calendarLink");
  if (cal) cal.href = calendarUrl;

  const acc = $("accountingLink");
  if (acc) acc.href = accountingUrl;
}

// ---------- KPIs ----------
function buildKpis(list) {
  const kpis = $("kpis");
  if (!kpis) return;

  const counts = { all: list.length, new: 0, confirmed: 0, cancelled: 0 };
  list.forEach((a) => (counts[a.status] = (counts[a.status] || 0) + 1));

  kpis.innerHTML = "";

  const items = [
    { label: 'סה״כ', value: counts.all },
    { label: 'חדש', value: counts.new || 0 },
    { label: 'אושר', value: counts.confirmed || 0 },
    { label: 'בוטל', value: counts.cancelled || 0 },
  ];

  items.forEach((it) => {
    const div = document.createElement("div");
    div.className = "admin-kpi";
    div.innerHTML = `<div class="admin-kpi-value">${it.value}</div><div class="admin-kpi-label">${it.label}</div>`;
    kpis.appendChild(div);
  });
}

// ---------- filters ----------
function applyFilters(list) {
  const q = ($("searchInput")?.value || "").trim().toLowerCase();
  const status = $("statusFilter")?.value || "all";
  const service = $("serviceFilter")?.value || "all";
  const date = $("dateFilter")?.value || "";

  return list.filter((a) => {
    const patientName =
      (a.patients?.full_name || `${a.first_name || ""} ${a.last_name || ""}`.trim()).toLowerCase();

    if (q && !patientName.includes(q)) return false;
    if (date && a.date !== date) return false;
    if (status !== "all" && a.status !== status) return false;
    if (service !== "all" && a.service !== service) return false;
    return true;
  });
}

// ---------- Today ----------
function renderToday() {
  const wrap = $("todayList");
  const badge = $("todayCountBadge");
  if (!wrap || !badge) return;

  const t = todayIso();

  const todays = allAppointments
    .filter((a) => a.date === t && a.status !== "cancelled")
    .sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));

  badge.textContent = `היום: ${todays.length}`;
  wrap.innerHTML = "";

  if (!todays.length) {
    wrap.innerHTML = `<div class="today-card"><div class="today-meta"><strong>אין מטופלים להיום</strong></div></div>`;
    return;
  }

  todays.forEach((a) => {
    const patientName =
      a.patients?.full_name || `${a.first_name || ""} ${a.last_name || ""}`.trim() || "—";

    const patientId = a.patient_id ? String(a.patient_id) : "";
    const reason = serviceLabel(a.service);
    const time = a.time || "";

    const lv = patientId ? lastVisitByPatient.get(patientId) : null;
    const lvLine = lv ? firstLine(lv.summary || lv.doctor_notes || "") : "";

    const inv = patientId ? lastInvoiceByPatient.get(patientId) : null;
    const isPaid = inv && String(inv.status).toLowerCase() === "paid";
    const payBadge = isPaid
      ? `<span class="badge badge-ok">שולם</span>`
      : `<span class="badge badge-warn">לא שולם</span>`;

    const div = document.createElement("div");
    div.className = "today-card";
    div.innerHTML = `
      <div class="today-meta">
        <strong>${patientName}</strong>
        <span>${time ? `שעה: ${time}` : ""}${reason ? ` | ${reason}` : ""}</span>
        ${lvLine ? `<span style="color:#607080;">ביקור קודם: ${lvLine}</span>` : ``}
      </div>

      <div class="today-actions">
        ${payBadge}
        <button
          type="button"
          class="patient-open"
          data-patient-id="${patientId}"
          ${patientId ? "" : "disabled"}
        >
          פתח תיק
        </button>
      </div>
    `;
    wrap.appendChild(div);
  });
}

// ---------- Table ----------
function renderTable() {
  buildKpis(allAppointments);

  const body = $("appointmentsBody");
  if (!body) return;

  const list = applyFilters(allAppointments);
  body.innerHTML = "";

  if (!list.length) {
    body.innerHTML = `<tr><td colspan="8" class="admin-empty">אין בקשות להצגה</td></tr>`;
    return;
  }

  list.forEach((a) => {
    const patientName =
      a.patients?.full_name || `${a.first_name || ""} ${a.last_name || ""}`.trim() || "—";

    const patientId = a.patient_id ? String(a.patient_id) : "";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtDate(a.created_at)}</td>
      <td>
        <button type="button" class="patient-open" data-patient-id="${patientId}" ${patientId ? "" : "disabled"}>
          <strong>${patientName}</strong>
        </button>
      </td>
      <td>${serviceLabel(a.service)}</td>
      <td>${a.date || ""}</td>
      <td>${a.time || ""}</td>
      <td class="admin-notes">${(a.notes || "").replace(/</g, "&lt;")}</td>
      <td>
        <select class="admin-status" data-id="${a.id}">
          <option value="new" ${a.status === "new" ? "selected" : ""}>חדש</option>
          <option value="confirmed" ${a.status === "confirmed" ? "selected" : ""}>אושר</option>
          <option value="cancelled" ${a.status === "cancelled" ? "selected" : ""}>בוטל</option>
        </select>
      </td>
      <td class="admin-row-actions">
        <button class="btn-outline admin-delete" data-id="${a.id}" type="button">מחק</button>
      </td>
    `;
    body.appendChild(tr);
  });
}

// ---------- hydrate patient insights ----------
async function hydratePatientInsights(patientIds) {
  lastVisitByPatient = new Map();
  lastInvoiceByPatient = new Map();

  if (!patientIds.length) {
    const countEl = $("accountingCount");
    if (countEl) countEl.textContent = "0";
    return;
  }

  // Visits
  {
    const { data, error } = await sb
      .from("visits")
      .select("id, patient_id, visit_date, summary, doctor_notes, created_at")
      .in("patient_id", patientIds)
      .order("created_at", { ascending: false });

    if (!error && data) {
      data.forEach((v) => {
        const pid = String(v.patient_id);
        if (!lastVisitByPatient.has(pid)) lastVisitByPatient.set(pid, v);
      });
    }
  }

  // Invoices
  {
    const { data, error } = await sb
      .from("invoices")
      .select("id, patient_id, invoice_number, status, total, currency, created_at")
      .in("patient_id", patientIds)
      .order("created_at", { ascending: false });

    if (!error && data) {
      data.forEach((inv) => {
        const pid = String(inv.patient_id);
        if (!lastInvoiceByPatient.has(pid)) lastInvoiceByPatient.set(pid, inv);
      });
    }
  }

  const unpaid = Array.from(lastInvoiceByPatient.values()).filter(
    (inv) => String(inv.status).toLowerCase() !== "paid"
  ).length;

  const countEl = $("accountingCount");
  if (countEl) countEl.textContent = String(unpaid);
}

// ---------- data ----------
async function loadAppointments() {
  const { data, error } = await sb
    .from(TABLE)
    .select(`
      *,
      patients (
        id,
        full_name
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;

  allAppointments = data || [];

  const t = todayIso();
  const patientIds = Array.from(
    new Set(
      allAppointments
        .filter((a) => a.date === t && a.status !== "cancelled" && a.patient_id)
        .map((a) => String(a.patient_id))
    )
  );

  await hydratePatientInsights(patientIds);

  renderToday();
  renderTable();
}

// ---------- mutations ----------
async function updateStatus(id, status) {
  const { error } = await sb.from(TABLE).update({ status }).eq("id", id);
  if (error) throw error;

  const idx = allAppointments.findIndex((x) => x.id === id);
  if (idx >= 0) allAppointments[idx].status = status;

  renderToday();
  renderTable();
}

async function deleteAppointment(id) {
  const { error } = await sb.from(TABLE).delete().eq("id", id);
  if (error) throw error;

  allAppointments = allAppointments.filter((x) => x.id !== id);
  renderToday();
  renderTable();
}

// ---------- auth ----------
async function signIn() {
  setLoginError("");
  const email = ($("emailInput")?.value || "").trim();
  const password = $("passwordInput")?.value || "";

  if (!email || !password) return setLoginError("נא למלא אימייל וסיסמה.");

  setLoginError("מתחבר...");

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return setLoginError("התחברות נכשלה: " + error.message);

  setLoginError("");
  await onAuthReady();
}

async function signOut() {
  await sb.auth.signOut();
  await onAuthReady();
}

async function onAuthReady() {
  const { data } = await sb.auth.getSession();
  const session = data?.session;

  if (!session) {
    show("loginPanel", true);
    show("appPanel", false);
    const logout = $("logoutLink");
    if (logout) logout.style.display = "none";
    return;
  }

  show("loginPanel", false);
  show("appPanel", true);

  const logout = $("logoutLink");
  if (logout) logout.style.display = "";

  await loadClinicSettings();
  await loadAppointments();
}

// ---------- events ----------
function bindEvents() {
  on("loginBtn", "click", () => signIn().catch((err) => setLoginError(err.message)));
  on("logoutLink", "click", (e) => { e.preventDefault(); signOut(); });

  on("refreshBtn", "click", () => loadAppointments().catch((err) => alert(err.message)));

  $("searchInput")?.addEventListener("input", () => renderTable());
  $("statusFilter")?.addEventListener("change", () => renderTable());
  $("serviceFilter")?.addEventListener("change", () => renderTable());
  $("dateFilter")?.addEventListener("change", () => renderTable());

  on("toggleFiltersBtn", "click", () => {
    const p = $("filtersPanel");
    if (!p) return;
    p.style.display = (p.style.display === "none" || p.style.display === "") ? "" : "none";
  });

  document.addEventListener("change", (e) => {
    if (e.target && e.target.classList.contains("admin-status")) {
      updateStatus(e.target.getAttribute("data-id"), e.target.value)
        .catch((err) => alert("עדכון נכשל: " + err.message));
    }
  });

  document.addEventListener("click", (e) => {
    const openBtn = e.target.closest && e.target.closest(".patient-open");
    if (openBtn) {
      const pid = openBtn.getAttribute("data-patient-id");
      if (!pid) return;
      window.location.href = `./patient.html?patient_id=${encodeURIComponent(pid)}`;
      return;
    }

    const delBtn = e.target.closest && e.target.closest(".admin-delete");
    if (delBtn) {
      const id = delBtn.getAttribute("data-id");
      if (!confirm("למחוק את הבקשה הזו?")) return;
      deleteAppointment(id).catch((err) => alert("מחיקה נכשלה: " + err.message));
      return;
    }
  });
}

// ---------- init ----------
document.addEventListener("DOMContentLoaded", async () => {
  try {
    sb = window.getSupabaseClient();
    bindEvents();

    sb.auth.onAuthStateChange(() => {
      onAuthReady().catch((err) => alert("Auth error: " + err.message));
    });

    await onAuthReady();
  } catch (err) {
    console.error("[ADMIN] Fatal init error:", err);
    alert("Admin init error: " + err.message);
  }
});
