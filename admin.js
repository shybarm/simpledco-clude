/* FILE: admin.js
   LOCATION: /admin.js
   FULL COPY-PASTE
   (Includes: login, dashboard load, table render, filters, “קבצים” modal + signed URLs)
*/
(() => {
  "use strict";

  // -------------------------
  // Helpers
  // -------------------------
  const byId = (id) => document.getElementById(id);

  const el = (tag, attrs = {}, html = "") => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k === "dataset") Object.assign(node.dataset, v);
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    if (html) node.innerHTML = html;
    return node;
  };

  const escapeHtml = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const formatDateTime = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    // date input value is usually YYYY-MM-DD already
    return String(dateStr);
  };

  const normalizeService = (service) => {
    const m = {
      "general": "ייעוץ רפואי כללי",
      "home-visit": "ביקור בית",
      "chronic": "ניהול מחלות כרוניות",
      "preventive": "רפואה מונעת",
      "pediatric": "טיפול ילדים",
    };
    return m[String(service || "").trim()] || (service ? String(service) : "—");
  };

  const normalizeStatusLabel = (status) => {
    const s = String(status || "new").toLowerCase();
    if (s === "confirmed") return "אושר";
    if (s === "cancelled") return "בוטל";
    return "חדש";
  };

  const todayYMD = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // -------------------------
  // Supabase client
  // -------------------------
  function sb() {
    return window.getSupabaseClient();
  }

  // -------------------------
  // UI nodes
  // -------------------------
  const loginPanel = byId("loginPanel");
  const appPanel = byId("appPanel");

  const emailInput = byId("emailInput");
  const passwordInput = byId("passwordInput");
  const loginBtn = byId("loginBtn");
  const loginError = byId("loginError");
  const logoutLink = byId("logoutLink");

  const sideDoctorName = byId("sideDoctorName");
  const sideClinicMeta = byId("sideClinicMeta");
  const clinicSub = byId("clinicSub");

  const refreshBtn = byId("refreshBtn");

  const todayList = byId("todayList");
  const todayCountBadge = byId("todayCountBadge");

  const searchInput = byId("searchInput");
  const toggleFiltersBtn = byId("toggleFiltersBtn");
  const filtersPanel = byId("filtersPanel");

  const dateFilter = byId("dateFilter");
  const statusFilter = byId("statusFilter");
  const serviceFilter = byId("serviceFilter");

  const kpis = byId("kpis");
  const appointmentsBody = byId("appointmentsBody");

  // Attachments modal nodes (optional — exists in your admin.html if you added it)
  const filesModalBackdrop = byId("filesModalBackdrop");
  const closeFilesModalBtn = byId("closeFilesModal");
  const filesModalMeta = byId("filesModalMeta");
  const appointmentFilesBox = byId("appointment-files");

  // -------------------------
  // State
  // -------------------------
  let currentUser = null;
  let appointmentsCache = [];

  // -------------------------
  // Modal
  // -------------------------
  function openFilesModal(metaText) {
    if (!filesModalBackdrop) return;
    if (filesModalMeta) filesModalMeta.textContent = metaText || "";
    filesModalBackdrop.classList.add("open");
  }
  function closeFilesModal() {
    if (!filesModalBackdrop) return;
    filesModalBackdrop.classList.remove("open");
  }

  if (closeFilesModalBtn) closeFilesModalBtn.addEventListener("click", closeFilesModal);
  if (filesModalBackdrop) {
    filesModalBackdrop.addEventListener("click", (e) => {
      if (e.target === filesModalBackdrop) closeFilesModal();
    });
  }

  // -------------------------
  // Attachments loader
  // -------------------------
  async function loadAppointmentFiles(appointmentId) {
    if (!appointmentFilesBox) return;

    appointmentFilesBox.innerHTML = "טוען קבצים...";

    // NOTE:
    // - Table: appointment_files
    // - Columns expected: appointment_id, file_name, file_path, created_at
    // - Storage bucket expected: appointment-files
    const { data, error } = await sb()
      .from("appointment_files")
      .select("*")
      .eq("appointment_id", appointmentId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("appointment_files select error:", error);
      appointmentFilesBox.innerHTML = "שגיאה בטעינת קבצים";
      return;
    }

    if (!data || data.length === 0) {
      appointmentFilesBox.innerHTML = "לא צורפו קבצים";
      return;
    }

    appointmentFilesBox.innerHTML = "";
    for (const file of data) {
      const fileName = file.file_name || "קובץ";
      const filePath = file.file_path;

      if (!filePath) continue;

      const { data: signed, error: signErr } = await sb()
        .storage
        .from("appointment-files")
        .createSignedUrl(filePath, 60 * 10);

      if (signErr || !signed?.signedUrl) {
        console.error("createSignedUrl error:", signErr);
        continue;
      }

      const row = el("div", { class: "file-row" });
      row.innerHTML = `<a href="${signed.signedUrl}" target="_blank" rel="noopener">📎 ${escapeHtml(fileName)}</a>`;
      appointmentFilesBox.appendChild(row);
    }
  }

  // -------------------------
  // Auth
  // -------------------------
  async function setLoggedInUI(user) {
    currentUser = user;

    if (!user) {
      if (loginPanel) loginPanel.style.display = "";
      if (appPanel) appPanel.style.display = "none";
      if (logoutLink) logoutLink.style.display = "none";
      return;
    }

    if (loginPanel) loginPanel.style.display = "none";
    if (appPanel) appPanel.style.display = "";
    if (logoutLink) logoutLink.style.display = "";

    const email = user.email || "—";
    if (sideDoctorName) sideDoctorName.textContent = email;
    if (sideClinicMeta) sideClinicMeta.textContent = "מחובר";
    if (clinicSub) clinicSub.textContent = `מחובר כ: ${email}`;

    await loadDashboard();
  }

  async function initAuth() {
    const client = sb();

    // initial session
    const { data } = await client.auth.getSession();
    await setLoggedInUI(data?.session?.user || null);

    // live changes
    client.auth.onAuthStateChange(async (_event, session) => {
      await setLoggedInUI(session?.user || null);
    });
  }

  async function doLogin() {
    if (!emailInput || !passwordInput) return;

    const email = String(emailInput.value || "").trim();
    const password = String(passwordInput.value || "");

    if (loginError) {
      loginError.style.display = "none";
      loginError.textContent = "";
    }

    try {
      const { error } = await sb().auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      console.error("login error:", err);
      if (loginError) {
        loginError.textContent = "התחברות נכשלה. בדוק אימייל/סיסמה.";
        loginError.style.display = "";
      }
    }
  }

  async function doLogout(e) {
    e?.preventDefault?.();
    try {
      await sb().auth.signOut();
    } catch (err) {
      console.error("logout error:", err);
    }
  }

  if (loginBtn) loginBtn.addEventListener("click", doLogin);
  if (logoutLink) logoutLink.addEventListener("click", doLogout);

  // Enter-to-login
  if (passwordInput) {
    passwordInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doLogin();
    });
  }

  // -------------------------
  // Data loading
  // -------------------------
  async function fetchAppointments() {
    // NOTE: table is assumed "appointments"
    // fields expected (best-effort):
    // id, created_at, first_name/last_name OR firstName/lastName OR patient_name
    // service, date, time, notes, status
    const { data, error } = await sb()
      .from("appointments")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("appointments select error:", error);
      return [];
    }
    return data || [];
  }

  function getPatientName(row) {
    const fn = row.first_name ?? row.firstName ?? "";
    const ln = row.last_name ?? row.lastName ?? "";
    const full = `${fn} ${ln}`.trim();
    return row.patient_name || row.patientName || full || "—";
  }

  function applyFilters(rows) {
    let out = [...rows];

    // quick search by name
    const q = String(searchInput?.value || "").trim().toLowerCase();
    if (q) {
      out = out.filter((r) => getPatientName(r).toLowerCase().includes(q));
    }

    const df = String(dateFilter?.value || "").trim();
    if (df) {
      out = out.filter((r) => String(r.date || "").trim() === df);
    }

    const sf = String(serviceFilter?.value || "all");
    if (sf !== "all") {
      out = out.filter((r) => String(r.service || "").trim() === sf);
    }

    const st = String(statusFilter?.value || "all");
    if (st !== "all") {
      out = out.filter((r) => String(r.status || "new").toLowerCase() === st);
    }

    return out;
  }

  function renderKPIs(rows) {
    if (!kpis) return;

    const total = rows.length;
    const newCount = rows.filter((r) => String(r.status || "new").toLowerCase() === "new").length;
    const confirmedCount = rows.filter((r) => String(r.status || "").toLowerCase() === "confirmed").length;
    const cancelledCount = rows.filter((r) => String(r.status || "").toLowerCase() === "cancelled").length;

    kpis.innerHTML = `
      <div class="admin-kpi card" style="padding:14px 16px; border-radius:14px; background:#fff; border:1px solid rgba(0,0,0,.08);">
        <div style="color:#607080; font-size:13px; font-weight:800;">סה״כ</div>
        <div style="font-size:26px; font-weight:900; margin-top:4px;">${total}</div>
      </div>
      <div class="admin-kpi card" style="padding:14px 16px; border-radius:14px; background:#fff; border:1px solid rgba(0,0,0,.08);">
        <div style="color:#607080; font-size:13px; font-weight:800;">חדש</div>
        <div style="font-size:26px; font-weight:900; margin-top:4px;">${newCount}</div>
      </div>
      <div class="admin-kpi card" style="padding:14px 16px; border-radius:14px; background:#fff; border:1px solid rgba(0,0,0,.08);">
        <div style="color:#607080; font-size:13px; font-weight:800;">אושר</div>
        <div style="font-size:26px; font-weight:900; margin-top:4px;">${confirmedCount}</div>
      </div>
      <div class="admin-kpi card" style="padding:14px 16px; border-radius:14px; background:#fff; border:1px solid rgba(0,0,0,.08);">
        <div style="color:#607080; font-size:13px; font-weight:800;">בוטל</div>
        <div style="font-size:26px; font-weight:900; margin-top:4px;">${cancelledCount}</div>
      </div>
    `;
  }

  function renderToday(rows) {
    if (!todayList || !todayCountBadge) return;

    const t = todayYMD();
    const todays = rows.filter((r) => String(r.date || "").trim() === t);

    todayCountBadge.textContent = `היום: ${todays.length}`;
    todayList.innerHTML = "";

    if (todays.length === 0) {
      const empty = el("div", { class: "today-card" }, `<div class="today-meta">אין תורים להיום</div>`);
      todayList.appendChild(empty);
      return;
    }

    for (const a of todays.slice(0, 8)) {
      const meta = el("div", { class: "today-meta" });
      meta.innerHTML = `
        <div style="font-weight:900;">${escapeHtml(getPatientName(a))}</div>
        <div style="color:#607080;">${escapeHtml(normalizeService(a.service))}</div>
        <div style="color:#607080;">${escapeHtml(formatDate(a.date))} • ${escapeHtml(a.time || "—")}</div>
      `;

      const actions = el("div", { class: "today-actions" });
      actions.appendChild(el("span", { class: "badge badge-ok" }, normalizeStatusLabel(a.status)));

      const card = el("div", { class: "today-card" });
      card.appendChild(meta);
      card.appendChild(actions);

      todayList.appendChild(card);
    }
  }

  function renderTable(rows) {
    if (!appointmentsBody) return;
    appointmentsBody.innerHTML = "";

    if (!rows || rows.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="8" style="padding:16px; text-align:center; color:#607080;">אין נתונים להצגה</td>`;
      appointmentsBody.appendChild(tr);
      return;
    }

    for (const a of rows) {
      const tr = document.createElement("tr");

      const created = formatDateTime(a.created_at);
      const patient = getPatientName(a);
      const service = normalizeService(a.service);
      const date = formatDate(a.date);
      const time = a.time || "—";
      const notes = a.notes || a.note || "";

      const statusLabel = normalizeStatusLabel(a.status);

      tr.innerHTML = `
        <td>${escapeHtml(created)}</td>
        <td>${escapeHtml(patient)}</td>
        <td>${escapeHtml(service)}</td>
        <td>${escapeHtml(date)}</td>
        <td>${escapeHtml(time)}</td>
        <td style="max-width: 360px; white-space: normal;">${escapeHtml(notes)}</td>
        <td>${escapeHtml(statusLabel)}</td>
        <td></td>
      `;

      // Actions cell
      const actionsTd = tr.querySelector("td:last-child");

      const btnConfirm = el("button", { type: "button", class: "btn-primary", style: "padding:8px 12px; border-radius:10px; font-size:13px;" }, "אשר");
      const btnCancel = el("button", { type: "button", class: "btn-outline", style: "padding:8px 12px; border-radius:10px; font-size:13px;" }, "בטל");
      const btnFiles = el("button", { type: "button", class: "btn-outline", style: "padding:8px 12px; border-radius:10px; font-size:13px;" }, "קבצים");

      btnConfirm.addEventListener("click", async () => {
        await updateStatus(a.id, "confirmed");
      });
      btnCancel.addEventListener("click", async () => {
        await updateStatus(a.id, "cancelled");
      });
      btnFiles.addEventListener("click", async () => {
        // opens modal and loads signed urls
        openFilesModal(`מטופל: ${patient} • תור: ${a.id}`);
        await loadAppointmentFiles(a.id);
      });

      const wrap = el("div", { style: "display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-start;" });
      wrap.appendChild(btnFiles);
      wrap.appendChild(btnConfirm);
      wrap.appendChild(btnCancel);

      actionsTd.appendChild(wrap);

      appointmentsBody.appendChild(tr);
    }
  }

  async function updateStatus(appointmentId, status) {
    try {
      const { error } = await sb()
        .from("appointments")
        .update({ status })
        .eq("id", appointmentId);

      if (error) throw error;

      await loadDashboard();
    } catch (err) {
      console.error("updateStatus error:", err);
      alert("שגיאה בעדכון סטטוס");
    }
  }

  async function loadDashboard() {
    // Load appointments
    const rows = await fetchAppointments();
    appointmentsCache = rows;

    const filtered = applyFilters(rows);

    renderKPIs(filtered);
    renderToday(rows);
    renderTable(filtered);
  }

  // -------------------------
  // Filters UI
  // -------------------------
  if (toggleFiltersBtn && filtersPanel) {
    toggleFiltersBtn.addEventListener("click", () => {
      const isOpen = filtersPanel.style.display === "block";
      filtersPanel.style.display = isOpen ? "none" : "block";
    });
  }

  const rerenderFromCache = () => {
    const filtered = applyFilters(appointmentsCache);
    renderKPIs(filtered);
    renderTable(filtered);
  };

  if (searchInput) searchInput.addEventListener("input", rerenderFromCache);
  if (dateFilter) dateFilter.addEventListener("change", rerenderFromCache);
  if (statusFilter) statusFilter.addEventListener("change", rerenderFromCache);
  if (serviceFilter) serviceFilter.addEventListener("change", rerenderFromCache);

  if (refreshBtn) refreshBtn.addEventListener("click", loadDashboard);

  // -------------------------
  // Boot
  // -------------------------
  initAuth().catch((e) => console.error("initAuth failed:", e));
})();
