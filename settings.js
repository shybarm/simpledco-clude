// settings.js — doctor/clinic profile

console.log("[SETTINGS] loaded ✅");
const sb = window.getSupabaseClient();

// same place you add calendar link:
const CALENDAR_URL = "https://calendar.google.com/";

function $(id){ return document.getElementById(id); }

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

function setPreview(url) {
  const img = $("signaturePreview");
  const no = $("noSig");
  if (!url) {
    img.style.display = "none";
    no.style.display = "";
    return;
  }
  img.src = url;
  img.style.display = "";
  no.style.display = "none";
}

async function loadSettings() {
  const { data, error } = await sb
    .from("clinic_settings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) throw error;

  const row = data?.[0] || null;
  if (!row) return;

  $("doctorTitle").value = row.doctor_title || "";
  $("doctorName").value = row.doctor_name || "";
  $("licenseNumber").value = row.license_number || "";

  $("clinicName").value = row.clinic_name || "";
  $("clinicAddress").value = row.clinic_address || "";

  $("whatsapp").value = row.whatsapp || "";
  $("email").value = row.email || "";

  $("clinicHours").value = row.clinic_hours || "";
  $("signatureUrl").value = row.signature_url || "";

  setPreview(row.signature_url || "");
}

async function saveSettings() {
  const payload = {
    doctor_title: $("doctorTitle").value || null,
    doctor_name: $("doctorName").value.trim() || null,
    license_number: $("licenseNumber").value.trim() || null,
    clinic_name: $("clinicName").value.trim() || null,
    clinic_address: $("clinicAddress").value.trim() || null,
    whatsapp: $("whatsapp").value.trim() || null,
    email: $("email").value.trim() || null,
    clinic_hours: $("clinicHours").value.trim() || null,
    signature_url: $("signatureUrl").value.trim() || null,
    updated_at: new Date().toISOString(),
  };

  // upsert single row: if exists update newest, else insert
  const { data: existing } = await sb
    .from("clinic_settings")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(1);

  const id = existing?.[0]?.id;

  let res;
  if (id) {
    res = await sb.from("clinic_settings").update(payload).eq("id", id);
  } else {
    res = await sb.from("clinic_settings").insert(payload);
  }

  if (res.error) throw res.error;

  alert("✔ נשמר");
  await loadSettings();
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await requireAuth();

    $("logoutLink").addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });

    $("calendarLink").href = CALENDAR_URL;

    $("signatureUrl").addEventListener("input", (e) => setPreview(e.target.value.trim()));

    $("saveBtn").addEventListener("click", () =>
      saveSettings().catch((err) => alert(err.message))
    );

    $("refreshBtn").addEventListener("click", () =>
      loadSettings().catch((err) => alert(err.message))
    );

    await loadSettings();
  } catch (err) {
    console.error(err);
    alert("Settings init error: " + err.message);
  }
});
