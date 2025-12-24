(function () {
  const $ = (id) => document.getElementById(id);

  const loginPanel = $("loginPanel");
  const appPanel = $("appPanel");
  const loginBtn = $("loginBtn");
  const logoutLink = $("logoutLink");
  const loginError = $("loginError");
  const emailInput = $("emailInput");
  const passwordInput = $("passwordInput");

  const refreshBtn = $("refreshBtn");
  const sideDoctorName = $("sideDoctorName");
  const sideClinicMeta = $("sideClinicMeta");

  const patientsBody = $("patientsBody");
  const patientsCount = $("patientsCount");
  const patientsHint = $("patientsHint");
  const searchInput = $("searchInput");

  let sb = null;
  let session = null;
  let allPatients = [];

  function show(el) { if (el) el.style.display = ""; }
  function hide(el) { if (el) el.style.display = "none"; }
  function setText(el, txt) { if (el) el.textContent = txt == null ? "" : String(txt); }
  function safeStr(v) { return v == null ? "" : String(v); }

  function normDigits(v) {
    return safeStr(v).replace(/\D/g, "");
  }

  function fmtDate(v) {
    if (!v) return "—";
    // v is expected ISO date (yyyy-mm-dd)
    try {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return safeStr(v);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    } catch {
      return safeStr(v);
    }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function ensureSupabase() {
    sb = window.getSupabaseClient();
  }

  async function loadSession() {
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    session = data.session;
    return session;
  }

  function renderPatients(list) {
    if (!patientsBody) return;

    if (!list || list.length === 0) {
      patientsBody.innerHTML = "";
      setText(patientsCount, "0 מטופלים");
      setText(patientsHint, "לא נמצאו מטופלים.");
      return;
    }

    setText(patientsCount, `${list.length} מטופלים`);
    setText(patientsHint, "");

    patientsBody.innerHTML = list.map((p) => {
      const name = escapeHtml(p.full_name || "—");
      const phone = escapeHtml(p.phone || "—");
      const email = escapeHtml(p.email || "—");
      const pid = escapeHtml(p.personal_id || "—");
      const dob = escapeHtml(fmtDate(p.date_of_birth));
      const href = `./patient.html?patient_id=${encodeURIComponent(p.id)}`;

      return `
        <tr>
          <td>${name}</td>
          <td>${phone}</td>
          <td>${email}</td>
          <td>${pid}</td>
          <td>${dob}</td>
          <td style="text-align:left;">
            <a class="btn-secondary" href="${href}">הכנס לתיק</a>
          </td>
        </tr>
      `;
    }).join("");
  }

  function applySearch() {
    const q = safeStr(searchInput?.value).trim().toLowerCase();
    if (!q) {
      renderPatients(allPatients);
      return;
    }

    const qDigits = normDigits(q);

    const filtered = allPatients.filter((p) => {
      const name = safeStr(p.full_name).toLowerCase();
      const email = safeStr(p.email).toLowerCase();
      const pid = safeStr(p.personal_id).toLowerCase();
      const phoneDigits = normDigits(p.phone);

      if (name.includes(q) || email.includes(q) || pid.includes(q)) return true;
      if (qDigits && phoneDigits.includes(qDigits)) return true;
      return false;
    });

    renderPatients(filtered);
  }

  async function fetchPatients() {
    setText(patientsHint, "טוען מטופלים…");
    patientsBody.innerHTML = "";

    const { data, error } = await sb
      .from("patients")
      .select("id, full_name, email, phone, personal_id, date_of_birth")
      .order("full_name", { ascending: true })
      .limit(500);

    if (error) {
      console.error(error);
      setText(patientsHint, "שגיאה בטעינת מטופלים.");
      return;
    }

    allPatients = Array.isArray(data) ? data : [];
    renderPatients(allPatients);
  }

  async function doLogin() {
    hide(loginError);
    const email = safeStr(emailInput?.value).trim();
    const password = safeStr(passwordInput?.value);

    if (!email || !password) {
      setText(loginError, "נא למלא אימייל וסיסמה.");
      show(loginError);
      return;
    }

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      setText(loginError, error.message || "שגיאת התחברות");
      show(loginError);
      return;
    }

    session = data.session;
    await onAuthed();
  }

  async function doLogout() {
    await sb.auth.signOut();
    session = null;
    hide(appPanel);
    show(loginPanel);
    hide(logoutLink);
  }

  async function onAuthed() {
    hide(loginPanel);
    show(appPanel);
    show(logoutLink);

    setText(sideDoctorName, "Back Office");
    setText(sideClinicMeta, "מטופלים");

    await fetchPatients();
  }

  async function init() {
    try {
      await ensureSupabase();
      await loadSession();

      if (session) {
        await onAuthed();
      } else {
        show(loginPanel);
        hide(appPanel);
        hide(logoutLink);
      }

      loginBtn?.addEventListener("click", doLogin);
      logoutLink?.addEventListener("click", (e) => {
        e.preventDefault();
        doLogout();
      });
      refreshBtn?.addEventListener("click", () => fetchPatients());
      searchInput?.addEventListener("input", () => applySearch());

    } catch (err) {
      console.error(err);
      setText(loginError, "שגיאה בטעינה. בדוק חיבור/מפתח Supabase.");
      show(loginError);
      show(loginPanel);
      hide(appPanel);
    }
  }

  init();
})();
