(function () {
  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);

  const loginPanel = $("loginPanel");
  const appPanel = $("appPanel");
  const loginBtn = $("loginBtn");
  const logoutLink = $("logoutLink");
  const loginError = $("loginError");
  const emailInput = $("emailInput");
  const passwordInput = $("passwordInput");

  const refreshBtn = $("refreshBtn");
  const toggleFiltersBtn = $("toggleFiltersBtn");
  const filtersPanel = $("filtersPanel");

  const clinicSub = $("clinicSub");
  const sideDoctorName = $("sideDoctorName");
  const sideClinicMeta = $("sideClinicMeta");

  const todayList = $("todayList");
  const todayCountBadge = $("todayCountBadge");

  const searchInput = $("searchInput");
  const dateFilter = $("dateFilter");
  const statusFilter = $("statusFilter");
  const serviceFilter = $("serviceFilter");

  const appointmentsBody = $("appointmentsBody");
  const kpis = $("kpis");
  const accountingCount = $("accountingCount");

  // Optional modal nodes (only used if you added them in admin.html)
  const filesModalBackdrop = $("filesModalBackdrop");
  const filesModalMeta = $("filesModalMeta");
  const closeFilesModal = $("closeFilesModal");
  const appointmentFilesHost = $("appointment-files");

  // ---------- State ----------
  let sb = null;
  let session = null;
  let allAppointments = [];
  let lastScrollY = 0;

  // ---------- Utils ----------
  function show(el) { if (el) el.style.display = ""; }
  function hide(el) { if (el) el.style.display = "none"; }
  function setText(el, txt) { if (el) el.textContent = txt == null ? "" : String(txt); }
  function safeStr(v) { return v == null ? "" : String(v); }

  function isoToday() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function labelService(v) {
    const map = {
      "general": "ייעוץ רפואי כללי",
      "home-visit": "ביקור בית",
      "chronic": "ניהול מחלות כרוניות",
      "preventive": "רפואה מונעת",
      "pediatric": "טיפול ילדים",
    };
    return map[v] || safeStr(v) || "—";
  }

  function labelStatus(v) {
    const map = { "new": "חדש", "confirmed": "אושר", "cancelled": "בוטל" };
    return map[v] || safeStr(v) || "—";
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function toast(msg, type) {
    const t = document.createElement("div");
    t.style.position = "fixed";
    t.style.left = "16px";
    t.style.right = "16px";
    t.style.bottom = "16px";
    t.style.zIndex = "999999";
    t.style.padding = "14px 16px";
    t.style.borderRadius = "10px";
    t.style.boxShadow = "0 8px 30px rgba(0,0,0,.12)";
    t.style.fontFamily = "Heebo, Arial, sans-serif";
    t.style.fontSize = "16px";
    t.style.textAlign = "center";
    t.style.background = type === "error" ? "#ffe5e5" : "#e9fff1";
    t.style.color = type === "error" ? "#8a0000" : "#0b5a2a";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => {
      t.style.opacity = "0";
      t.style.transition = "opacity .25s ease";
      setTimeout(() => t.remove(), 300);
    }, 2200);
  }

  function requireSupabase() {
    if (typeof window.getSupabaseClient !== "function") {
      throw new Error("Supabase client factory missing (getSupabaseClient).");
    }
    return window.getSupabaseClient();
  }

  // ---------- Modal scroll lock ----------
  function lockBodyScroll() {
    // Preserve scroll position & prevent background scroll (avoids "jump" on open)
    lastScrollY = window.scrollY || 0;

    const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarW > 0) document.body.style.paddingRight = `${scrollbarW}px`;

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${lastScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  }

  function unlockBodyScroll() {
    const top = document.body.style.top;

    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    document.body.style.paddingRight = "";

    const y = top ? Math.abs(parseInt(top, 10)) : lastScrollY;
    window.scrollTo(0, y || 0);
  }

  function openFilesModal(metaText) {
    if (!filesModalBackdrop) return;
    filesModalBackdrop.setAttribute("aria-hidden", "false");
    filesModalBackdrop.classList.add("open");
    lockBodyScroll();
    setText(filesModalMeta, metaText || "");
  }

  function closeFilesModalFn() {
    if (!filesModalBackdrop) return;
    filesModalBackdrop.setAttribute("aria-hidden", "true");
    filesModalBackdrop.classList.remove("open");
    unlockBodyScroll();
    if (appointmentFilesHost) appointmentFilesHost.innerHTML = "—";
    setText(filesModalMeta, "");
  }

  // ---------- Data ----------
  async function loadAppointments() {
    let rows = [];

    // Try RPC (if you created it)
    try {
      const { data, error } = await sb.rpc("list_appointments");
      if (!error && Array.isArray(data)) rows = data;
    } catch (_) {}

    // Fallback: direct select
    if (!rows.length) {
      const { data, error } = await sb
        .from("appointments")
        .select("id, created_at, first_name, last_name, service, date, time, notes, status")
        .order("created_at", { ascending: false });

      if (error) throw error;
      rows = data || [];
    }

    allAppointments = rows;
    renderAll();
  }

  function applyFilters(rows) {
    const q = safeStr(searchInput?.value).trim().toLowerCase();
    const d = safeStr(dateFilter?.value).trim();
    const st = safeStr(statusFilter?.value || "all");
    const sv = safeStr(serviceFilter?.value || "all");

    return rows.filter((r) => {
      const fullName = `${safeStr(r.first_name)} ${safeStr(r.last_name)}`.trim().toLowerCase();
      if (q && !fullName.includes(q)) return false;
      if (d && safeStr(r.date) !== d) return false;
      if (st !== "all" && safeStr(r.status) !== st) return false;
      if (sv !== "all" && safeStr(r.service) !== sv) return false;
      return true;
    });
  }

  function renderKPIs(rows) {
    if (!kpis) return;

    const total = rows.length;
    const byStatus = { new: 0, confirmed: 0, cancelled: 0 };
    for (const r of rows) {
      const s = safeStr(r.status);
      if (byStatus[s] != null) byStatus[s] += 1;
    }

    kpis.innerHTML = `
      <div class="kpi-card kpi-total"><div class="kpi-label">סה"כ</div><div class="kpi-value">${total}</div></div>
      <div class="kpi-card kpi-new"><div class="kpi-label">חדש</div><div class="kpi-value">${byStatus.new}</div></div>
      <div class="kpi-card kpi-confirmed"><div class="kpi-label">אושר</div><div class="kpi-value">${byStatus.confirmed}</div></div>
      <div class="kpi-card kpi-cancelled"><div class="kpi-label">בוטל</div><div class="kpi-value">${byStatus.cancelled}</div></div>
    `;
  }


  function renderToday(rows) {
    if (!todayList || !todayCountBadge) return;

    const t = isoToday();
    const today = rows.filter((r) => safeStr(r.date) === t);

    setText(todayCountBadge, `היום: ${today.length}`);
    todayList.innerHTML = "";

    if (!today.length) {
      todayList.innerHTML = `<div style="color:#607080; padding:10px 0;">אין תורים להיום.</div>`;
      return;
    }

    for (const r of today.slice(0, 8)) {
      const name = `${safeStr(r.first_name)} ${safeStr(r.last_name)}`.trim() || "—";
      const time = safeStr(r.time) || "—";
      const service = labelService(r.service);
      const status = labelStatus(r.status);

      const card = document.createElement("div");
      card.className = "today-card";
      card.innerHTML = `
        <div class="today-meta">
          <div style="font-weight:800;">${escapeHtml(name)}</div>
          <div style="color:#607080; font-size:13px;">${escapeHtml(service)} • ${escapeHtml(time)}</div>
          <div style="color:#607080; font-size:13px;">סטטוס: ${escapeHtml(status)}</div>
        </div>
        <div class="today-actions">
          <button class="btn-outline btn-sm js-open-patient" data-id="${escapeHtml(r.id)}" type="button">מטופל</button>
          <button class="btn-outline btn-sm js-open-files" data-id="${escapeHtml(r.id)}" type="button">קבצים</button>
        </div>
      `;
      todayList.appendChild(card);
    }
  }

  function renderTable(rows) {
    if (!appointmentsBody) return;

    appointmentsBody.innerHTML = "";

    for (const r of rows) {      const patientName = `${safeStr(r.first_name)} ${safeStr(r.last_name)}`.trim() || "—";
      const service = labelService(r.service);
      const date = safeStr(r.date) || "—";
      const time = safeStr(r.time) || "—";
      const notes = safeStr(r.notes) || "—";
      const status = labelStatus(r.status);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <button class="patient-open js-open-patient" type="button" data-id="${escapeHtml(r.id)}">
            ${escapeHtml(patientName)}
          </button>
        </td>

        <td>${escapeHtml(service)}</td>
        <td>${escapeHtml(date)}</td>
        <td>${escapeHtml(time)}</td>
        <td style="max-width:320px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${escapeHtml(notes)}
        </td>
        <td>${escapeHtml(status)}</td>
        <td style="white-space:nowrap;">
          <button class="btn-outline btn-sm js-open-files" type="button" data-id="${escapeHtml(r.id)}">קבצים</button>
        </td>
      `;
      appointmentsBody.appendChild(tr);
    }
  }

  function renderAll() {
    const filtered = applyFilters(allAppointments);
    renderKPIs(filtered);
    renderToday(allAppointments);
    renderTable(filtered);

    const confirmed = allAppointments.filter((r) => safeStr(r.status) === "confirmed").length;
    if (accountingCount) accountingCount.textContent = String(confirmed);
  }

  // ---------- Patient + Files actions ----------
  async function openPatient(appointmentId) {
    const appt = allAppointments.find((x) => safeStr(x.id) === safeStr(appointmentId));
    if (!appt) return;

    const name = `${safeStr(appt.first_name)} ${safeStr(appt.last_name)}`.trim();
    const meta = `${name || "מטופל"} • ${labelService(appt.service)} • ${safeStr(appt.date)} ${safeStr(appt.time)}`;

    // If you didn't add the modal HTML, just do nothing (keeps dashboard stable)
    if (!filesModalBackdrop || !appointmentFilesHost) {
      toast("כדי לפתוח כרטיס מטופל, הוסף את מודאל הקבצים ל-admin.html", "error");
      return;
    }

    openFilesModal(meta);

    appointmentFilesHost.innerHTML = `
      <div class="files-block">
        <div class="files-head">
          <div style="font-weight:900;">פרטי מטופל</div>
        </div>
        <div class="files-card">
          <div><strong>שם:</strong> ${escapeHtml(name || "—")}</div>
          <div><strong>שירות:</strong> ${escapeHtml(labelService(appt.service))}</div>
          <div><strong>תאריך:</strong> ${escapeHtml(safeStr(appt.date) || "—")}</div>
          <div><strong>שעה:</strong> ${escapeHtml(safeStr(appt.time) || "—")}</div>
          <div style="margin-top:8px;"><strong>הערות:</strong><br/>${escapeHtml(safeStr(appt.notes) || "—")}</div>
          <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
            <button class="btn-primary btn-sm js-enter-file" type="button" data-patient-id="${escapeHtml(safeStr(appt.patient_id)||"")}">הכנס לתיק</button>
          </div>
        </div>

        <div class="files-head" style="margin-top:14px;">
          <div style="font-weight:900;">קבצים מצורפים</div>
        </div>
        <div id="filesList">טוען קבצים…</div>
      </div>
    `;

    await loadFilesInto("filesList", appointmentId);
  }

  async function openFilesOnly(appointmentId) {
    if (!filesModalBackdrop || !appointmentFilesHost) {
      toast("כדי לפתוח קבצים, הוסף את מודאל הקבצים ל-admin.html", "error");
      return;
    }

    const appt = allAppointments.find((x) => safeStr(x.id) === safeStr(appointmentId));
    const name = appt ? `${safeStr(appt.first_name)} ${safeStr(appt.last_name)}`.trim() : "—";
    const meta = `${name || "מטופל"} • ${labelService(appt?.service)} • ${safeStr(appt?.date)} ${safeStr(appt?.time)}`;

    openFilesModal(meta);
    appointmentFilesHost.innerHTML = `<div id="filesList">טוען קבצים…</div>`;
    await loadFilesInto("filesList", appointmentId);
  }

  async function loadFilesInto(hostId, appointmentId) {
    const host = $(hostId);
    if (!host) return;

    let files = [];
    try {
      const { data, error } = await sb
        .from("appointment_files")
        .select("id, appointment_id, file_name, file_path, file_type, created_at")
        .eq("appointment_id", appointmentId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      files = data || [];
    } catch (e) {
      console.error("loadFiles error:", e);
      host.innerHTML = `<div style="color:#b00020;">שגיאה בטעינת קבצים</div>`;
      return;
    }

    if (!files.length) {
      host.innerHTML = `<div style="color:#607080;">אין קבצים מצורפים.</div>`;
      return;
    }

    const BUCKET = "appointment-files";

    const ul = document.createElement("div");
    ul.className = "files-list";

    for (const f of files) {
      const fileName = safeStr(f.file_name) || "file";
      const filePath = safeStr(f.file_path);

      let url = "";
      try {
        const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(filePath, 60 * 20);
        if (error) throw error;
        url = data?.signedUrl || "";
      } catch (e) {
        console.error("signedUrl error:", e);
        url = "";
      }

      const row = document.createElement("div");
      row.className = "file-row";
      row.innerHTML = `
        <div class="file-meta">
          <div class="file-name">${escapeHtml(fileName)}</div>
          <div class="file-sub">${escapeHtml(safeStr(f.file_type) || "")}</div>
        </div>
        <div class="file-actions">
          ${
            url
              ? `<a class="btn-outline btn-sm" href="${escapeHtml(url)}" target="_blank" rel="noopener">פתח</a>`
              : `<span style="color:#607080; font-size:12px;">אין הרשאה/קישור</span>`
          }
        </div>
      `;
      ul.appendChild(row);
    }

    host.innerHTML = "";
    host.appendChild(ul);
  }

  // ---------- Auth ----------
  async function restoreSession() {
    const { data } = await sb.auth.getSession();
    session = data?.session || null;
    if (session) {
      hide(loginPanel);
      show(appPanel);
      if (logoutLink) show(logoutLink);
      await bootAfterLogin();
    } else {
      show(loginPanel);
      hide(appPanel);
      if (logoutLink) hide(logoutLink);
    }
  }

  async function doLogin() {
    if (loginError) hide(loginError);

    const email = safeStr(emailInput?.value).trim();
    const password = safeStr(passwordInput?.value);

    if (!email || !password) {
      setText(loginError, "נא להזין אימייל וסיסמה.");
      if (loginError) show(loginError);
      return;
    }

    if (loginBtn) loginBtn.disabled = true;

    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;

      session = data?.session || null;

      hide(loginPanel);
      show(appPanel);
      if (logoutLink) show(logoutLink);

      await bootAfterLogin();
      toast("✅ התחברת בהצלחה", "success");
    } catch (e) {
      console.error(e);
      setText(loginError, "התחברות נכשלה: " + (e?.message || "שגיאה"));
      if (loginError) show(loginError);
    } finally {
      if (loginBtn) loginBtn.disabled = false;
    }
  }

  async function doLogout() {
    try { await sb.auth.signOut(); } catch (_) {}
    session = null;
    show(loginPanel);
    hide(appPanel);
    if (logoutLink) hide(logoutLink);
    toast("התנתקת", "success");
  }

  async function bootAfterLogin() {
    setText(sideDoctorName, "Back Office");
    setText(sideClinicMeta, "ניהול תורים וקבצים");
    setText(clinicSub, "רשימת תורים + קבצים מצורפים");
    await loadAppointments();
  }

  // ---------- Events ----------
  function wireEvents() {
    if (loginBtn) loginBtn.addEventListener("click", doLogin);
    if (logoutLink) logoutLink.addEventListener("click", (e) => { e.preventDefault(); doLogout(); });

    if (refreshBtn) refreshBtn.addEventListener("click", () => loadAppointments().catch(console.error));

    if (toggleFiltersBtn && filtersPanel) {
      filtersPanel.style.display = "none";
      toggleFiltersBtn.addEventListener("click", () => {
        const isOpen = filtersPanel.style.display !== "none";
        filtersPanel.style.display = isOpen ? "none" : "block";
      });
    }

    const refilter = () => renderAll();
    if (searchInput) searchInput.addEventListener("input", refilter);
    if (dateFilter) dateFilter.addEventListener("change", refilter);
    if (statusFilter) statusFilter.addEventListener("change", refilter);
    if (serviceFilter) serviceFilter.addEventListener("change", refilter);

    document.addEventListener("click", async (e) => {
      const t = e.target;

      const patientBtn = t?.closest?.(".js-open-patient");
      if (patientBtn) {
        const id = patientBtn.getAttribute("data-id");
        if (id) await openPatient(id);
        return;
      }

      const enterBtn = t?.closest?.(".js-enter-file");
      if (enterBtn) {
        const pid = enterBtn.getAttribute("data-patient-id");
        if (!pid) {
          toast("לא נמצא patient_id לתיק מטופל (בדוק שהשדה patient_id קיים בטבלת appointments).", "error");
          return;
        }
        window.location.href = `./patient.html?patient_id=${encodeURIComponent(pid)}`;
        return;
      }

      const filesBtn = t?.closest?.(".js-open-files");
      if (filesBtn) {
        const id = filesBtn.getAttribute("data-id");
        if (id) await openFilesOnly(id);
        return;
      }
    });

    if (closeFilesModal) closeFilesModal.addEventListener("click", closeFilesModalFn);

    if (filesModalBackdrop) {
      filesModalBackdrop.addEventListener("click", (e) => {
        if (e.target === filesModalBackdrop) closeFilesModalFn();
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && filesModalBackdrop?.classList.contains("open")) {
        closeFilesModalFn();
      }
    });
  }

  // ---------- Init ----------
  async function init() {
    try {
      sb = requireSupabase();
    } catch (e) {
      console.error(e);
      toast("שגיאת מערכת: Supabase לא נטען", "error");
      return;
    }

    wireEvents();
    await restoreSession();

    sb.auth.onAuthStateChange(async (_event, _session) => {
      session = _session || null;
      if (session) {
        hide(loginPanel);
        show(appPanel);
        if (logoutLink) show(logoutLink);
        await bootAfterLogin();
      } else {
        show(loginPanel);
        hide(appPanel);
        if (logoutLink) hide(logoutLink);
      }
    });
  }

  init().catch(console.error);
})();
