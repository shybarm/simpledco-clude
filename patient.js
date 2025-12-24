// patient.js — Patient file: details, appointments, visits, invoices (+ allergies checkbox + EDIT visits)

console.log("[PATIENT] patient.js loaded ✅");

const sb = window.getSupabaseClient();

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
// Hard guard: if the param is missing/invalid, DO NOT run any queries (avoids showing other patients' data).
if (!patientId || patientId === "undefined" || patientId === "null") {
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

  if (!data.length) {
    wrap.innerHTML = `<div class="row">אין תורים</div>`;
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
}

// ---------- appointment files (Storage + DB refs) ----------
async function loadAppointmentFiles() {
  const wrap = $("appointmentFilesList");
  if (!wrap) return;
  wrap.innerHTML = "";

  // appointment_files rows contain (appointment_id, file_name, file_path, file_type)
  // We join to appointments to ensure we only show files for this patient.
  const { data, error } = await sb
    .from("appointment_files")
    .select("id, file_name, file_path, file_type, created_at, appointment_id, appointments:appointment_id(patient_id, date, time, service)")
    .eq("appointments.patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[PATIENT] loadAppointmentFiles error:", error);
    wrap.innerHTML = `<div class="row">שגיאה בטעינת קבצים</div>`;
    return;
  }

  if (!data || data.length === 0) {
    wrap.innerHTML = `<div class="row">אין קבצים מצורפים</div>`;
    return;
  }

  // Create short-lived signed URLs for download/view
  for (const f of data) {
    const appt = f.appointments || {};
    const when = [appt.date, appt.time].filter(Boolean).join(" ");
    const svc = serviceLabel(appt.service);

    let signedUrl = null;
    try {
      const { data: urlData, error: urlErr } = await sb.storage
        .from("appointment-files")
        .createSignedUrl(f.file_path, 60 * 60); // 1 hour
      if (!urlErr) signedUrl = urlData?.signedUrl || null;
      else console.warn("[PATIENT] signedUrl error", urlErr);
    } catch (e) {
      console.warn("[PATIENT] signedUrl exception", e);
    }

    const div = document.createElement("div");
    div.className = "row";
    div.innerHTML = `
      <div class="meta">
        <strong>${escHtml(f.file_name || "קובץ")}</strong>
        <span>${when ? `תור: ${escHtml(when)}${svc ? ` | ${escHtml(svc)}` : ""}` : ""}</span>
        <span style="color:#607080;">${escHtml(f.file_type || "")}</span>
      </div>
      <div class="actions">
        ${signedUrl ? `<a class="btn-outline" href="${signedUrl}" target="_blank" rel="noopener">פתח</a>` : `<span style="color:#889;">אין קישור</span>`}
      </div>
    `;
    wrap.appendChild(div);
  }
}

// ---------- uploaded files (appointments/<appointmentId>/...) ----------
async function loadUploadedFiles() {
  const wrap = $("filesList");
  if (!wrap) return;
  wrap.innerHTML = "";

  // 1) Get appointments for this patient (so we can group files).
  const { data: appts, error: apptsErr } = await sb
    .from("appointments")
    .select("id, date, time, service")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (apptsErr) throw apptsErr;

  if (!appts || appts.length === 0) {
    wrap.innerHTML = `<div class="row">אין קבצים</div>`;
    return;
  }

  const apptIds = appts.map((a) => a.id);

  // 2) Fetch file rows.
  const { data: files, error: filesErr } = await sb
    .from("appointment_files")
    .select("id, appointment_id, file_name, file_path, file_type, created_at")
    .in("appointment_id", apptIds)
    .order("created_at", { ascending: false });

  if (filesErr) throw filesErr;

  if (!files || files.length === 0) {
    wrap.innerHTML = `<div class="row">אין קבצים</div>`;
    return;
  }

  // 3) Group by appointment_id.
  const byAppt = new Map();
  files.forEach((f) => {
    const k = String(f.appointment_id);
    if (!byAppt.has(k)) byAppt.set(k, []);
    byAppt.get(k).push(f);
  });

  // 4) Render groups. Use signed URLs (private bucket-safe).
  for (const a of appts) {
    const list = byAppt.get(String(a.id));
    if (!list || list.length === 0) continue;

    const group = document.createElement("div");
    group.className = "row";
    group.innerHTML = `
      <div class="meta">
        <strong>קבצים לתור: ${escHtml(a.date || "")} ${escHtml(a.time || "")}</strong>
        <span style="color:#607080;">${escHtml(serviceLabel(a.service))}</span>
      </div>
      <div class="files" style="margin-top:10px; display:flex; flex-direction:column; gap:8px;"></div>
    `;

    const filesWrap = group.querySelector(".files");

    for (const f of list) {
      // Signed URL for 1 hour
      const { data: signed, error: signErr } = await sb.storage
        .from("appointment-files")
        .createSignedUrl(f.file_path, 60 * 60);

      if (signErr || !signed?.signedUrl) {
        const line = document.createElement("div");
        line.innerHTML = `<span>${escHtml(f.file_name)}</span> <span style="color:#b91c1c;">(לא ניתן לייצר לינק)</span>`;
        filesWrap.appendChild(line);
        continue;
      }

      const aEl = document.createElement("a");
      aEl.href = signed.signedUrl;
      aEl.target = "_blank";
      aEl.rel = "noopener";
      aEl.className = "btn-outline";
      aEl.style.display = "inline-flex";
      aEl.style.alignItems = "center";
      aEl.style.justifyContent = "center";
      aEl.style.width = "fit-content";
      aEl.style.gap = "8px";
      aEl.textContent = `פתח: ${f.file_name}`;
      filesWrap.appendChild(aEl);
    }

    wrap.appendChild(group);
  }

  // If we rendered nothing (no files per appt)
  if (!wrap.children.length) wrap.innerHTML = `<div class="row">אין קבצים</div>`;
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

  const { data, error } = await sb
    .from("visits")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  if (!data.length) {
    wrap.innerHTML = `<div class="row">אין ביקורים</div>`;
    return;
  }

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
        await loadAppointmentFiles();
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
    await loadAppointmentFiles();
    await loadVisits();
    await loadInvoices();
  } catch (err) {
    console.error("[PATIENT] init error:", err);
    alert("Patient init error: " + err.message);
  }
});
