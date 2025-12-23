// patient.js — Patient file: details, appointments, visits, invoices

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
  $("patientMeta").textContent = `נוצר: ${new Date(
    patient.created_at
  ).toLocaleString("he-IL")}`;

  $("fullNameInput").value = patient.full_name || "";
  $("emailInput").value = patient.email || "";
  $("phoneInput").value = patient.phone || "";

  $("personalIdInput").value = patient.personal_id || "";
  $("dobInput").value = patient.date_of_birth || "";
  $("allergiesInput").value = patient.allergies || "";
}

// ---------- save patient ----------
async function savePatient() {
  const full_name = $("fullNameInput").value.trim();
  const email = $("emailInput").value.trim();
  const phone = $("phoneInput").value.trim();

  const personal_id = $("personalIdInput").value.trim();
  const date_of_birth = $("dobInput").value || null;
  const allergies = $("allergiesInput").value.trim();

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

// ---------- visits ----------
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
        <strong>${v.visit_date}</strong>
        <span>${v.summary || ""}</span>
        <span>${v.doctor_notes || ""}</span>
      </div>
    `;
    wrap.appendChild(div);
  });
}

async function createVisit() {
  const visit_date = $("visitDateInput").value;
  const summary = $("visitSummaryInput").value.trim();
  const doctor_notes = $("visitNotesInput").value.trim();

  if (!visit_date) {
    alert("בחר תאריך");
    return;
  }

  const { error } = await sb.from("visits").insert({
    patient_id: patientId,
    visit_date,
    summary,
    doctor_notes,
  });

  if (error) throw error;

  $("visitSummaryInput").value = "";
  $("visitNotesInput").value = "";

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
        <strong>${inv.invoice_number}</strong>
        <span>סה״כ: ${money(inv.total)} ${inv.currency || "ILS"}</span>
        <span>סטטוס: ${inv.status}</span>
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
      } catch (err) {
        alert(err.message);
      }
    });

    $("createVisitBtn").addEventListener("click", () =>
      createVisit().catch((err) => alert(err.message))
    );

    // defaults
    $("visitDateInput").value = new Date().toISOString().slice(0, 10);

    await loadPatient();
    await loadAppointments();
    await loadVisits();
    await loadInvoices();
  } catch (err) {
    console.error("[PATIENT] init error:", err);
    alert("Patient init error: " + err.message);
  }
});
