/* FILE: admin.js
   LOCATION: /admin.js
   ADD THIS BLOCK near the TOP of the file (after byId helpers if you have them)
   COPY-PASTE
*/
function openFilesModal(metaText) {
  const backdrop = document.getElementById("filesModalBackdrop");
  const meta = document.getElementById("filesModalMeta");
  if (meta) meta.textContent = metaText || "";
  if (backdrop) backdrop.classList.add("open");
}
function closeFilesModal() {
  const backdrop = document.getElementById("filesModalBackdrop");
  if (backdrop) backdrop.classList.remove("open");
}

document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "closeFilesModal") closeFilesModal();
  if (e.target && e.target.id === "filesModalBackdrop") closeFilesModal();
});

/* FILE: admin.js
   LOCATION: /admin.js
   ADD THIS FUNCTION (anywhere in admin.js, but BEFORE you call it)
   COPY-PASTE
*/
async function loadAppointmentFiles(supabase, appointmentId) {
  const container = document.getElementById("appointment-files");
  if (!container) return;

  container.innerHTML = "טוען קבצים...";

  const { data, error } = await supabase
    .from("appointment_files")
    .select("*")
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    container.innerHTML = "שגיאה בטעינת קבצים";
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = "לא צורפו קבצים";
    return;
  }

  container.innerHTML = "";

  for (const file of data) {
    const { data: signed, error: signErr } = await supabase.storage
      .from("appointment-files")
      .createSignedUrl(file.file_path, 60 * 10);

    if (signErr || !signed?.signedUrl) {
      console.error(signErr);
      continue;
    }

    const row = document.createElement("div");
    row.className = "file-row";
    row.innerHTML = `<a href="${signed.signedUrl}" target="_blank" rel="noopener">📎 ${file.file_name}</a>`;
    container.appendChild(row);
  }
}
