// admin.js — Supabase Auth Back Office (FULL FILE, patient navigation bulletproof)

window.__ADMIN_LOADED = true;
console.log("[ADMIN] admin.js loaded ✅");

const TABLE = "appointments";
let sb = null;
let allAppointments = [];

// ---------------- helpers ----------------
function $(id) {
  return document.getElementById(id);
}

function on(id, event, handler) {
  const el = $(id);
  if (!el) {
    console.warn(`[ADMIN] Missing element #${id} (cannot bind ${event})`);
    return false;
  }
  el.addEventListener(event, handler);
  return true;
}

function show(id, yes) {
  const el = $(id);
  if (!el) return;
  el.style.display = yes ? "" : "none";
}

function setLoginError(msg) {
  const el = $("loginError");
  if (!el) return;
  el.textContent = msg || "";
  el.style.display = msg ? "" : "none";
}

function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
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
  const q = ($("searchInput")?.value || "").trim().toLowerCase();
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
      a.patients?.full_name,
    ]
      .filter(Boolean)
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
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="10" class="admin-empty">אין בקשות להצגה</td>`;
    body.appendChild(tr);
    return;
  }

  list.forEach((a) => {
    const patientName =
      a.patients?.full_name || `${a.first_name || ""} ${a.last_name || ""}`.trim();

    const patientId = a.patient_id ? String(a.patient_id) : "";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtDate(a.created_at)}</td>

      <td class="patient-cell">
        <button
          type="button"
          class="patient-open btn-linklike"
          data-patient-id="${patientId}"
          ${patientId ? "" : "disabled"}
          title="${patientId ? "פתח תיק מטופל" : "אין patient_id"}"
        >
          <strong>${patientName || "—"}</strong>
        </button>
      </td>

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
      <td class="admin-row-actions">
        <button class="btn-outline admin-delete" data-id="${a.id}" type="button">מחק</button>
      </td>
    `;
    body.appendChild(tr);
  });
}

// ---------------- data ----------------
async function loadAppointments() {
  const { data, error } = await sb
    .from(TABLE)
    .select(
      `
      *,
      patients (
        id,
        full_name
      )
    `
    )
    .order("created_at", { ascending: false });

  if (error) throw error;

  allAppointments = data || [];
  render();
}

async function updateStatus(id, status) {
  const { error } = await sb.from(TABLE).update({ status }).eq("id", id);
  if (error) throw error;

  const idx = allAppointments.findIndex((x) => x.id === id);
  if (idx >= 0) allAppointments[idx].status = status;
  render();
}

async function deleteAppointment(id) {
  const { error } = await sb.from(TABLE).delete().eq("id", id);
  if (error) throw error;

  allAppointments = allAppointments.filter((x) => x.id !== id);
  render();
}

function exportCsv() {
  const list = allAppointments;
  const headers = [
    "created_at",
    "status",
    "first_name",
    "last_name",
    "phone",
    "email",
    "service",
    "date",
    "time",
    "notes",
    "patient_id",
  ];
  const rows = [headers.join(",")];

  list.forEach((a) => {
    const row = headers
      .map((h) => {
        const val = (a[h] ?? "").toString().replace(/"/g, '""');
        return `"${val}"`;
      })
      .join(",");
    rows.push(row);
  });

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "appointments.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---------------- auth ----------------
async function signIn() {
  setLoginError("");
  const email = ($("emailInput")?.value || "").trim();
  const password = $("passwordInput")?.value || "";

  if (!email || !password) {
    setLoginError("נא למלא אימייל וסיסמה.");
    return;
  }

  setLoginError("מתחבר...");

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    setLoginError("התחברות נכשלה: " + error.message);
    return;
  }

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
  await loadAppointments();
}

// ---------------- events ----------------
function bindEvents() {
  on("loginBtn", "click", () => signIn().catch((err) => setLoginError(err.message)));
  on("logoutLink", "click", (e) => {
    e.preventDefault();
    signOut();
  });
  on("refreshBtn", "click", () => loadAppointments().catch((err) => alert(err.message)));
  on("exportBtn", "click", exportCsv);

  const si = $("searchInput");
  if (si) si.addEventListener("input", render);

  const sf = $("statusFilter");
  if (sf) sf.addEventListener("change", render);

  const svc = $("serviceFilter");
  if (svc) svc.addEventListener("change", render);

  // Status change
  document.addEventListener("change", (e) => {
    if (e.target && e.target.classList.contains("admin-status")) {
      updateStatus(e.target.getAttribute("data-id"), e.target.value).catch((err) =>
        alert("עדכון נכשל: " + err.message)
      );
    }
  });

  // Clicks: patient open + delete
  document.addEventListener("click", (e) => {
    const openBtn = e.target.closest && e.target.closest(".patient-open");
    if (openBtn) {
      const patientId = openBtn.getAttribute("data-patient-id");
      console.log("[ADMIN] OPEN PATIENT:", patientId);

      if (!patientId) return;

      // If patient.html is in same folder as admin.html
      window.location.href = `./patient.html?patient_id=${patientId}`;
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

// ---------------- init ----------------
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
