// admin.js — Supabase Auth Back Office (null-safe bindings)
window.__ADMIN_LOADED = true;
console.log("[ADMIN] admin.js loaded ✅");

const TABLE = "appointments";
let sb = null;
let allAppointments = [];

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

function applyFilters(list) {
  const q = ($("searchInput")?.value || "").trim().toLowerCase();
  const status = $("statusFilter")?.value || "all";
  const service = $("serviceFilter")?.value || "all";

  return list.filter((a) => {
    const hay = [
      a.first_name, a.last_name, a.phone, a.email, a.notes,
      a.service, a.date, a.time, a.status
    ].join(" ").toLowerCase();

    if (q && !hay.includes(q)) return false;
    if (status !== "all" && a.status !== status) return false;
    if (service !== "all" && a.service !== service) return false;
    return true;
  });
}

function render() {
  buildKpis(allAppointments);

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
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtDate(a.created_at)}</td>
      <td><strong>${(a.first_name || "")} ${(a.last_name || "")}</strong></td>
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

async function loadAppointments() {
  const { data, error } = await sb
    .from(TABLE)
    .select("*")
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
  const headers = ["created_at","status","first_name","last_name","phone","email","service","date","time","notes"];
  const rows = [headers.join(",")];

  list.forEach((a) => {
    const row = headers.map((h) => {
      const val = (a[h] ?? "").toString().replace(/"/g, '""');
      return `"${val}"`;
    }).join(",");
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

function bindEvents() {
  on("loginBtn", "click", () => signIn().catch((err) => setLoginError(err.message)));
  on("logoutLink", "click", (e) => { e.preventDefault(); signOut(); });
  on("refreshBtn", "click", () => loadAppointments().catch((err) => alert(err.message)));
  on("exportBtn", "click", exportCsv);

  const si = $("searchInput");
  if (si) si.addEventListener("input", render);

  const sf = $("statusFilter");
  if (sf) sf.addEventListener("change", render);

  const svc = $("serviceFilter");
  if (svc) svc.addEventListener("change", render);

  document.addEventListener("change", (e) => {
    if (e.target && e.target.classList.contains("admin-status")) {
      updateStatus(e.target.getAttribute("data-id"), e.target.value)
        .catch((err) => alert("עדכון נכשל: " + err.message));
    }
  });

  document.addEventListener("click", (e) => {
    if (e.target && e.target.classList.contains("admin-delete")) {
      const id = e.target.getAttribute("data-id");
      if (!confirm("למחוק את הבקשה הזו?")) return;
      deleteAppointment(id).catch((err) => alert("מחיקה נכשלה: " + err.message));
    }
  });
}

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
