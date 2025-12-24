// FILE: script.js
// LOCATION: /script.js
// FULL COPY-PASTE
// FIXES:
// 1) Storage upload now uses upsert:true (prevents “already exists” edge)
// 2) Adds explicit checks + better logging for appointmentFiles input
// 3) Ensures DB insert happens and shows why it fails (RLS / missing columns / wrong types)
// 4) Adds small delay after RPC (helps if triggers/replication timing exist)

async function uploadAppointmentFiles(supabase, appointmentId) {
  const input = document.getElementById("appointmentFiles");

  if (!appointmentId) {
    console.error("uploadAppointmentFiles: missing appointmentId");
    return;
  }

  if (!input) {
    console.warn("uploadAppointmentFiles: #appointmentFiles not found in DOM");
    return;
  }

  if (!input.files || input.files.length === 0) {
    // no files selected
    return;
  }

  // Safety: bucket name must match your Supabase Storage bucket
  const BUCKET = "appointment-files";

  for (const file of input.files) {
    try {
      const safeName = String(file.name || "file").replace(/[^\w.\-() ]/g, "_");
      const filePath = `appointments/${appointmentId}/${Date.now()}_${safeName}`;

      // 1) Upload to Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true, // IMPORTANT: avoids occasional "already exists"
          contentType: file.type || undefined,
        });

      if (uploadError) {
        console.error("File upload failed:", {
          appointmentId,
          fileName: file.name,
          filePath,
          uploadError,
        });
        continue; // do not block appointment
      }

      // 2) Insert into DB appointment_files
      const payload = {
        appointment_id: appointmentId,
        file_name: file.name,
        file_path: filePath,
        file_type: file.type || null,
      };

      const { error: dbError } = await supabase
        .from("appointment_files")
        .insert(payload);

      if (dbError) {
        console.error("DB insert failed (appointment_files):", {
          payload,
          dbError,
          hint:
            "Likely RLS or missing insert permission on appointment_files. Also verify columns: appointment_id, file_name, file_path, file_type.",
        });
      } else {
        console.log("appointment_files row created:", {
          appointmentId,
          fileName: file.name,
          filePath,
          uploadData,
        });
      }
    } catch (e) {
      console.error("uploadAppointmentFiles: unexpected error:", e);
    }
  }
}

(function () {
  function byId(id) {
    return document.getElementById(id);
  }

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
    const lastName = getFormValue(form, "lastName");
    const email = getFormValue(form, "email");
    const phone = getFormValue(form, "phone");
    const service = getFormValue(form, "service");
    const date = getFormValue(form, "date"); // YYYY-MM-DD
    const time = getFormValue(form, "time");
    const notes = getFormValue(form, "notes");

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
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "שולח...";
    }

    try {
      // RPC creates appointment and returns UUID
      const { data, error } = await sb.rpc("create_appointment", {
        p_first_name: firstName,
        p_last_name: lastName,
        p_email: email,
        p_phone: phone,
        p_service: service,
        p_date: date,
        p_time: time,
        p_notes: notes || null,
      });

      if (error) {
        console.error("RPC error:", error);
        showToast("שליחה נכשלה: " + error.message, "error");
        return;
      }

      const appointmentId = data;
      console.log("Appointment created:", appointmentId);

      // tiny delay (helps in some setups with triggers/latency)
      await new Promise((r) => setTimeout(r, 80));

      // Upload files (optional)
      try {
        await uploadAppointmentFiles(sb, appointmentId);
      } catch (uploadErr) {
        console.error("Upload flow error:", uploadErr);
      }

      form.reset();
      showToast("✅ הבקשה נשלחה! נחזור אליך בהקדם לאישור התור.", "success");
    } catch (err) {
      console.error(err);
      showToast("שליחה נכשלה: Network error", "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = oldBtnText || "שלח בקשה";
      }
    }
  };
})();
