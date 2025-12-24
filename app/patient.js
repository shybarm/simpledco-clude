// patient.js — Patient file: details, appointments, visits, invoices (+ allergies checkbox + EDIT visits)

console.log("[PATIENT] patient.js loaded ✅");

const sb = window.getSupabaseClient();

// Storage bucket for appointment attachments
const STORAGE_BUCKET = "appointment-files";
let cachedAppointmentIds = [];

// ---------- helpers ----------
function $(id) {
  return document.getElementById(id);
}

function qparam(name) {
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

function money(n) {
  const x = Number(n || 0);
  return x.toFixed(2);
}

function setActiveTab(tab) {
  document.querySelectorAll(".tab").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === tab)
  );
  document.querySelectorAll(".panel").forEach((p) =>
    p.classList.toggle("active", p.id === `panel-${tab}`)
  );
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

async function getFileUrl(filePath) {
  if (!filePath) return null;
  // Signed URL first (works for private buckets).
  const { data: signed, error: signedErr } = await sb.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(filePath, 60 * 60);

  if (!signedErr && signed?.signedUrl) return signed.signedUrl;

  // Fallback: public bucket
  const pub = sb.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
  if (pub?.data?.publicUrl) return pub.data.publicUrl;

  console.warn("[FILES] Could not create URL", signedErr);
  return null;
}

function renderFiles(files) {
  const wrap = $("filesList");
  if (!wrap) return;
  wrap.innerHTML = "";

  if (!files || files.length === 0) {
    wrap.innerHTML = `<div class="empty">אין קבצים מצורפים.</div>`;
    return;
  }

  files.forEach((f) => {
    const row = document.createElement("div");
    row.className = "row";

    const left = document.createElement("div");
    left.className = "meta";

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = f.file_name || "קובץ";

    const sub = document.createElement("div");
    sub.className = "sub";
    const when = [f.date, f.time].filter(Boolean).join(" ");
    sub.textContent = when ? `תור: ${when}` : "";

    left.appendChild(title);
    left.appendChild(sub);

    const actions = document.createElement("div");
    actions.className = "actions";

    const a = document.createElement("a");
    a.className = "btn-outline";
    a.href = f.url || "#";
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "פתיחה";
    if (!f.url) {
      a.setAttribute("aria-disabled", "true");
      a.style.pointerEvents = "none";
      a.style.opacity = "0.6";
    }
    actions.appendChild(a);

    row.appendChild(left);

    // Optional preview for images
    if (f.file_type && f.file_type.startsWith("image/") && f.url) {
      const img = document.createElement("img");
      img.src = f.url;
      img.alt = f.file_name || "";
      img.style.width = "56px";
      img.style.height = "56px";
      img.style.objectFit = "cover";
      img.style.borderRadius = "12px";
      img.style.border = "1px solid rgba(0,0,0,.06)";
      row.appendChild(img);
    }

    row.appendChild(actions);
    wrap.appendChild(row);
  });
}

function safeShow(id, yes) {
  const el = $(id);
  if (!el) return;
  el.style.display = yes ? "" : "none";
}

function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---------- auth ----------
async function requireAuth() {
  const { data } = await sb.auth.getSession();
  if (!data?.session) {
    window.location.href = "./admin.html";
    return null;
  }
  return data.session;
}

async function logout() {
  await sb.auth.signOut();
  window.location.href = "./admin.html";
}

// ---------- state ----------
const patientId = qparam("patient_id");
if (!patientId) {
  alert("Missing patient_id");
  window.location.href = "./admin.html";
}

let patient = null;

// ---------- allergies UI ----------
function syncAllergiesUiFromValue(value) {
  const has = !!(value && String(value).trim());
  const cb = $("hasAllergiesCheckbox");
  if (cb) cb.checked = has;
  safeShow("allergiesBox", has);
}

function bindAllergiesToggle() {
  const cb = $("hasAllergiesCheckbox");
  if (!cb) return;

  cb.addEventListener("change", (e) => {
    const yes = !!e.target.checked;
    safeShow("allergiesBox", yes);
    if (!yes && $("allergiesInput")) $("allergiesInput").value = "";
  });
}

// ---------- load patient ----------
async function loadPatient() {
  const { data, error } = await sb
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .single();

  if (error) throw error;

  patient = data;

  // hide internal id – show only created date
  const meta = $("patientMeta");
  if (meta) {
    meta.textContent = `נוצר: ${new Date(patient.created_at).toLocaleString("he-IL")}`;
  }

  $("fullNameInput").value = patient.full_name || "";
  $("emailInput").value = patient.email || "";
  $("phoneInput").value = patient.phone || "";

  $("personalIdInput").value = patient.personal_id || "";
  $("dobInput").value = patient.date_of_birth || "";

  if ($("allergiesInput")) $("allergiesInput").value = patient.allergies || "";
  syncAllergiesUiFromValue(patient.allergies || "");
}

// ---------- save patient ----------
async function savePatient() {
  const full_name = $("fullNameInput").value.trim();
  const email = $("emailInput").value.trim();
  const phone = $("phoneInput").value.trim();

  const personal_id = $("personalIdInput").value.trim();
  const date_of_birth = $("dobInput").value || null;

  const hasAllergies = $("hasAllergiesCheckbox")
    ? $("hasAllergiesCheckbox").checked
    : false;
  const allergies = hasAllergies ? ($("allergiesInput")?.value || "").trim() : null;

  const { error } = await sb
    .from("patients")
    .update({ full_name, email, phone, personal_id, date_of_birth, allergies })
    .eq("id", patientId);

  if (error) throw error;

  alert("✔ נשמר");
  await loadPatient();
}

// ---------- appointments ----------
async function loadAppointments() {
  const wrap = $("appointmentsList");
  wrap.innerHTML = "";

  const { data, error } = await sb
    .from("appointments")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Cache appointment ids so we can load attachments
  cachedAppointmentIds = (data || []).map((a) => a.id).filter(Boolean);

  if (!data.length) {
    wrap.innerHTML = `<div class="row">אין תורים</div>`;

    // Ensure files panel doesn't show an error for new patients
    renderFiles([]);
    return;
  }

  data.forEach((a) => {
    const div = document.createElement("div");
    div.className = "row";
    div.innerHTML = `
      <div class="meta">
        <strong>${serviceLabel(a.service)}</strong>
        <span>${a.date || ""} ${a.time || ""}</span>
        <span>סטטוס: ${a.status}</span>
      </div>
    `;
    wrap.appendChild(div);
  });

  // Load attachments for these appointments
  await loadAppointmentFiles();
}

async function loadAppointmentFiles() {
  const wrap = $("filesList");
  if (!wrap) return;
  wrap.innerHTML = `<div class="row">טוען קבצים...</div>`;

  if (!cachedAppointmentIds || cachedAppointmentIds.length === 0) {
    renderFiles([]);
    return;
  }

  // 1) Fetch file rows
  const { data: rows, error } = await sb
    .from("appointment_files")
    .select("id, appointment_id, file_name, file_path, file_type, created_at")
    .in("appointment_id", cachedAppointmentIds)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[FILES] DB error", error);
    wrap.innerHTML = `<div class="row">שגיאה בטעינת קבצים</div>`;
    return;
  }

  if (!rows || rows.length === 0) {
    renderFiles([]);
    return;
  }

  // 2) Fetch appointment metadata (date/time) for display
  const { data: appts, error: apptErr } = await sb
    .from("appointments")
    .select("id, date, time")
    .in("id", cachedAppointmentIds);
  if (apptErr) console.warn("[FILES] appointments fetch warning", apptErr);
  const apptMap = new Map((appts || []).map((a) => [a.id, a]));

  // 3) Build view models + URLs
  const out = [];
  for (const r of rows) {
    const meta = apptMap.get(r.appointment_id) || {};
    const url = await getFileUrl(r.file_path);
    out.push({
      ...r,
      date: meta.date || "",
      time: meta.time || "",
      url,
    });
  }

  renderFiles(out);
}

// ---------- visits (editable) ----------
let editingVisitId = null;

function openVisitEditor(visit) {
  editingVisitId = visit.id;

  $("visitDateInput").value = visit.visit_date || new Date().toISOString().slice(0, 10);
  $("visitSummaryInput").value = visit.summary || "";
  $("visitNotesInput").value = visit.doctor_notes || "";

  const btn = $("createVisitBtn");
  if (btn) btn.textContent = "שמור שינויים";

  setActiveTab("visits");
}

function resetVisitEditor() {
  editingVisitId = null;

  $("visitDateInput").value = new Date().toISOString().slice(0, 10);
  $("visitSummaryInput").value = "";
  $("visitNotesInput").value = "";

  const btn = $("createVisitBtn");
  if (btn) btn.textContent = "צור ביקור";
}

async function loadVisits() {
  const wrap = $("visitsList");
  wrap.innerHTML = "";
  const title = $("visitsHistoryTitle");

  const { data, error } = await sb
    .from("visits")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  if (!data.length) {
    if (title) title.style.display = "none";
    wrap.innerHTML = `<div class="row">אין ביקורים</div>`;
    return;
  }

  if (title) title.style.display = "";

  data.forEach((v) => {
    const div = document.createElement("div");
    div.className = "row";
    div.innerHTML = `
      <div class="meta">
        <strong>${escHtml(v.visit_date)}</strong>
        <span>${escHtml(v.summary || "")}</span>
        <span>${escHtml(v.doctor_notes || "")}</span>
      </div>
      <div class="actions">
        <button type="button" class="btn-outline visit-edit" data-id="${v.id}">ערוך</button>
      </div>
    `;
    wrap.appendChild(div);
  });

  // attach edit handlers
  wrap.querySelectorAll(".visit-edit").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const visit = data.find((x) => String(x.id) === String(id));
      if (!visit) return;
      openVisitEditor(visit);
    });
  });
}

async function createOrUpdateVisit() {
  const visit_date = $("visitDateInput").value;
  const summary = $("visitSummaryInput").value.trim();
  const doctor_notes = $("visitNotesInput").value.trim();

  if (!visit_date) {
    alert("בחר תאריך");
    return;
  }

  if (!editingVisitId) {
    const { error } = await sb.from("visits").insert({
      patient_id: patientId,
      visit_date,
      summary,
      doctor_notes,
    });
    if (error) throw error;

    alert("✔ ביקור נוצר");
    resetVisitEditor();
    await loadVisits();
    setActiveTab("visits");
    return;
  }

  // update existing visit
  const { error } = await sb
    .from("visits")
    .update({ visit_date, summary, doctor_notes })
    .eq("id", editingVisitId)
    .eq("patient_id", patientId);

  if (error) throw error;

  alert("✔ ביקור עודכן");
  resetVisitEditor();
  await loadVisits();
  setActiveTab("visits");
}

// ---------- invoices (read-only for now) ----------
async function loadInvoices() {
  const wrap = $("invoicesList");
  wrap.innerHTML = "";

  const { data, error } = await sb
    .from("invoices")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  if (!data.length) {
    wrap.innerHTML = `<div class="row">אין חשבוניות</div>`;
    return;
  }

  data.forEach((inv) => {
    const div = document.createElement("div");
    div.className = "row";
    div.innerHTML = `
      <div class="meta">
        <strong>${escHtml(inv.invoice_number)}</strong>
        <span>סה״כ: ${money(inv.total)} ${escHtml(inv.currency || "ILS")}</span>
        <span>סטטוס: ${escHtml(inv.status)}</span>
      </div>
    `;
    wrap.appendChild(div);
  });
}

// ---------- init ----------
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await requireAuth();

    document.querySelectorAll(".tab").forEach((b) =>
      b.addEventListener("click", () => setActiveTab(b.dataset.tab))
    );

    $("logoutLink").addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });

    $("savePatientBtn").addEventListener("click", () =>
      savePatient().catch((err) => alert(err.message))
    );

    $("refreshBtn").addEventListener("click", async () => {
      try {
        await loadPatient();
        await loadAppointments();
        await loadVisits();
        await loadInvoices();
        resetVisitEditor();
      } catch (err) {
        alert(err.message);
      }
    });

    // Create OR Update visit (same button)
    $("createVisitBtn").addEventListener("click", () =>
      createOrUpdateVisit().catch((err) => alert(err.message))
    );

    // allergies checkbox toggle
    bindAllergiesToggle();

    // defaults
    $("visitDateInput").value = new Date().toISOString().slice(0, 10);
    resetVisitEditor();

    await loadPatient();
    await loadAppointments();
    await loadVisits();
    await loadInvoices();
  } catch (err) {
    console.error("[PATIENT] init error:", err);
    alert("Patient init error: " + err.message);
  }
});
