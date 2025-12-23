// admin.js — Supabase Auth Back Office (clean + patient-safe)

window.__ADMIN_LOADED = true;
console.log("[ADMIN] admin.js loaded ✅");

const TABLE = "appointments";
let sb = null;
let allAppointments = [];

// ---------------- helpers ----------------
const $ = (id) => document.getElementById(id);

function on(id, event, handler) {
  const el = $(id);
  if (!el) return;
  el.addEventListener(event, handler);
}

function show(id, yes) {
  const el = $(id);
  if (el) el.style.display = yes ? "" : "none";
}

function setLoginError(msg) {
  const el = $("loginError");
  if (!el) return;
  el.textContent = msg || "";
  el.style.display = msg ? "" : "none";
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString("he-IL", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso || "";
  }
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

// ---------------- filters ----------------
function applyFilters(list) {
  const q = ($("searchInput")?.value || "").toLowerCase();
  const status = $("statusFilter")?.value || "all";
  const service = $("serviceFilter")?.value || "all";

  return list.filter((a) => {
    const hay = [
      a.first_name,
      a.last_name,
      a.phone,
      a.email,
      a.notes,
      a.service,
      a.date,
      a.time,
      a.status,
    ]
      .join(" ")
      .toLowerCase();

    if (q && !hay.includes(q)) return false;
    if (status !== "all" && a.status !== status) return false;
    if (service !== "all" && a.service !== service) return false;
    return true;
  });
}

// ---------------- render ----------------
function render() {
  const body = $("appointmentsBody");
  if (!body) return;

  const list = applyFilters(allAppointments);
  body.innerHTML = "";

  if (!list.length) {
    body.innerHTML =
      `<tr><td colspan="10" class="admin-empty">אין בקשות להצגה</td></tr>`;
    return;
  }

  list.forEach((a) => {
    const patientName =
      a.patients?.full_name ||
      `${a.first_name || ""} ${a.last_name || ""}`;

    const nameCell = a.patient_id
      ? `<a href="patient.html?patient_id=${a.patient_id}">
           <strong>${patientName}</strong>
         </a>`
      : `<strong>${patientName}</strong>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtDate(a.created_at)}</td>
      <td>${nameCell}</td>
      <td><a href="tel:${a.phone || ""}">${a.phone || ""}</a></td>
      <td><a href="mailto:${a.email || ""}">${a.email || ""}</a></td>
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
      <td>
        <button class="admin-delete" data-id="${a.id}">מחק</button>
      </td>
    `;
    body.appendChild(tr);
  });
}

// ---------------- data ----------------
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
  render();
}

async function updateStatus(id, status) {
  await sb.from(TABLE).update({ status }).eq("id", id);
  const row = allAppointments.find((x) => x.id === id);
  if (row) row.status = status;
  render();
}

async function deleteAppointment(id) {
  await sb.from(TABLE).delete().eq("id", id);
  allAppointments = allAppointments.filter((x) => x.id !== id);
  render();
}

// ---------------- auth ----------------
async function signIn() {
  setLoginError("");
  const email = $("emailInput")?.value || "";
  const password = $("passwordInput")?.value || "";
  if (!email || !password) return setLoginError("נא למלא אימייל וסיסמה");

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return setLoginError(error.message);
  await onAuthReady();
}

async function signOut() {
  await sb.auth.signOut();
  await onAuthReady();
}

async function onAuthReady() {
  const { data } = await sb.auth.getSession();
  const session = data?.session;

  show("loginPanel", !session);
  show("appPanel", !!session);
  if (session) await loadAppointments();
}

// ---------------- events ----------------
function bindEvents() {
  on("loginBtn", "click", signIn);
  on("logoutLink", "click", (e) => {
    e.preventDefault();
    signOut();
  });
  on("refreshBtn", "click", loadAppointments);

  $("searchInput")?.addEventListener("input", render);
  $("statusFilter")?.addEventListener("change", render);
  $("serviceFilter")?.addEventListener("change", render);

  document.addEventListener("change", (e) => {
    if (e.target.classList.contains("admin-status")) {
      updateStatus(e.target.dataset.id, e.target.value);
    }
  });

  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("admin-delete")) {
      if (!confirm("למחוק?")) return;
      deleteAppointment(e.target.dataset.id);
    }
  });
}

// ---------------- init ----------------
document.addEventListener("DOMContentLoaded", async () => {
  sb = window.getSupabaseClient();
  bindEvents();
  sb.auth.onAuthStateChange(onAuthReady);
  await onAuthReady();
});
