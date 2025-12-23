// script.js
// Website logic + appointment form submission to Supabase (appointments table)

(function () {
  // ---------- Helpers ----------
  function byId(id) {
    return document.getElementById(id);
  }

  function showToast(message, type) {
    // Minimal inline toast (no CSS dependencies)
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
    if (!el) return "";
    return (el.value || "").toString().trim();
  }

  // ---------- Navigation / Menu ----------
  window.toggleMenu = function toggleMenu() {
    const navLinks = byId("navLinks");
    if (!navLinks) return;
    navLinks.classList.toggle("active");
  };

  // ---------- Chat (optional; keep if your UI has it) ----------
  window.toggleChat = function toggleChat() {
    const chatWindow = byId("chatWindow");
    if (!chatWindow) return;
    chatWindow.style.display = chatWindow.style.display === "block" ? "none" : "block";
  };

  window.handleChatKey = function handleChatKey(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      window.sendMessage();
    }
  };

  window.sendMessage = function sendMessage() {
    const input = byId("chatInput");
    const messages = byId("chatMessages");
    if (!input || !messages) return;

    const text = (input.value || "").trim();
    if (!text) return;

    const userMsg = document.createElement("div");
    userMsg.className = "user-message";
    userMsg.textContent = text;
    messages.appendChild(userMsg);

    const botMsg = document.createElement("div");
    botMsg.className = "bot-message";
    botMsg.textContent = "תודה! אם תרצה, אתה יכול גם להשאיר פרטים בטופס קביעת התור ואנחנו נחזור אליך.";
    messages.appendChild(botMsg);

    input.value = "";
    messages.scrollTop = messages.scrollHeight;
  };

  // ---------- Appointment submit to Supabase ----------
  window.handleSubmit = async function handleSubmit(event) {
    event.preventDefault();

    const form = event.target;

    // Collect fields from your index.html
    const firstName = getFormValue(form, "firstName");
    const lastName = getFormValue(form, "lastName");
    const email = getFormValue(form, "email");
    const phone = getFormValue(form, "phone");
    const service = getFormValue(form, "service");
    const date = getFormValue(form, "date");
    const time = getFormValue(form, "time");
    const notes = getFormValue(form, "notes");

    // Basic validation (HTML required should already handle most)
    if (!firstName || !lastName || !email || !phone || !service || !date || !time) {
      showToast("נא למלא את כל השדות החובה.", "error");
      return;
    }

    // Ensure Supabase client exists
    if (typeof window.getSupabaseClient !== "function") {
      showToast("שגיאת מערכת: חסר חיבור למסד הנתונים (Supabase).", "error");
      console.error("getSupabaseClient() not found. Make sure Supabase scripts are included in index.html.");
      return;
    }

    let sb;
    try {
      sb = window.getSupabaseClient();
    } catch (err) {
      showToast("שגיאת מערכת: לא ניתן ליצור חיבור למסד הנתונים.", "error");
      console.error(err);
      return;
    }

    // Disable submit button to prevent double submits
    const submitBtn = form.querySelector('button[type="submit"]');
    const oldBtnText = submitBtn ? submitBtn.textContent : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "שולח...";
    }

    try {
      // Insert into public.appointments (matches your table schema)
      const payload = {
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone: phone,
        service: service,
        date: date,     // stored as date
        time: time,     // stored as text
        notes: notes,
        status: "new"
      };

      const { error } = await sb
        .from("appointments")
        .insert([payload]);

      if (error) {
        console.error("Supabase insert error:", error);
        showToast("שליחה נכשלה: " + error.message, "error");
        return;
      }

      // Success
      form.reset();
      showToast("✅ הבקשה נשלחה! נחזור אליך בהקדם לאישור התור.", "success");

      // Optional: scroll to top or to confirmation area
      // window.scrollTo({ top: 0, behavior: "smooth" });

    } catch (err) {
      console.error(err);
      showToast("שליחה נכשלה: Failed to fetch / Network error", "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = oldBtnText || "שלח בקשה";
      }
    }
  };
})();
