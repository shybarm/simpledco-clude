// script.js — Website + Appointment submit via RPC (create_appointment)

(function () {
  function byId(id) { return document.getElementById(id); }

  function showToast(message, type) {
    const toast = document.createElement("div");
    toast.style.position = "fixed";
    toast.style.left = "16px";
    toast.style.right = "16px";
    toast.style.bottom = "16px";
    toast.style.zIndex = "9999";
    toast.style.padding = "14px 16px";
    toast.style.borderRadius = "10px";
    toast.style.boxShadow = "0 8px 30px rgba(0,0,0,.12)";
    toast.style.fontFamily = "Heebo, Arial, sans-serif";
    toast.style.fontSize = "16px";
    toast.style.textAlign = "center";
    toast.style.background = type === "error" ? "#ffe5e5" : "#e9fff1";
    toast.style.color = type === "error" ? "#8a0000" : "#0b5a2a";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity .25s ease";
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  function getFormValue(form, name) {
    const el = form.elements[name];
    return el ? (el.value || "").toString().trim() : "";
  }

  window.toggleMenu = function () {
    const navLinks = byId("navLinks");
    if (!navLinks) return;
    navLinks.classList.toggle("active");
  };

  // Appointment submit
  window.handleSubmit = async function (event) {
    event.preventDefault();
    const form = event.target;

    const firstName = getFormValue(form, "firstName");
    const lastName  = getFormValue(form, "lastName");
    const email     = getFormValue(form, "email");
    const phone     = getFormValue(form, "phone");
    const service   = getFormValue(form, "service");
    const date      = getFormValue(form, "date");  // YYYY-MM-DD from <input type="date">
    const time      = getFormValue(form, "time");
    const notes     = getFormValue(form, "notes");

    if (!firstName || !lastName || !email || !phone || !service || !date || !time) {
      showToast("נא למלא את כל השדות החובה.", "error");
      return;
    }

    if (typeof window.getSupabaseClient !== "function") {
      showToast("שגיאת מערכת: חסר חיבור למסד הנתונים (Supabase).", "error");
      return;
    }

    let sb;
    try {
      sb = window.getSupabaseClient();
    } catch (e) {
      console.error(e);
      showToast("שגיאת מערכת: לא ניתן ליצור חיבור למסד הנתונים.", "error");
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const oldBtnText = submitBtn ? submitBtn.textContent : "";
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "שולח..."; }

    try {
      // Call the RPC (safe public entry point)
      const { data, error } = await sb.rpc("create_appointment", {
        p_first_name: firstName,
        p_last_name: lastName,
        p_email: email,
        p_phone: phone,
        p_service: service,
        p_date: date,
        p_time: time,
        p_notes: notes || null
      });

      if (error) {
        console.error("RPC error:", error);
        showToast("שליחה נכשלה: " + error.message, "error");
        return;
      }

      // data returns appointment UUID
      form.reset();
      showToast("✅ הבקשה נשלחה! נחזור אליך בהקדם לאישור התור.", "success");
      console.log("Appointment created:", data);

    } catch (err) {
      console.error(err);
      showToast("שליחה נכשלה: Network error", "error");
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = oldBtnText || "שלח בקשה"; }
    }
  };
})();
