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
    const { data: signed } = await supabase.storage
      .from("appointment-files")
      .createSignedUrl(file.file_path, 60 * 10);

    const row = document.createElement("div");
    row.className = "file-row";

    row.innerHTML = `
      <a href="${signed.signedUrl}" target="_blank">
        📎 ${file.file_name}
      </a>
    `;

    container.appendChild(row);
  }
}
