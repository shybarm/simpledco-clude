// supabase-client.js
// Frontend-safe Supabase configuration
// Uses Publishable Key + RLS (secure for browser)

window.SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co";
window.SUPABASE_ANON_KEY = "sb_publishable_REPLACE_ME";

window.getSupabaseClient = function () {
  if (!window.supabase) {
    throw new Error("Supabase SDK not loaded");
  }

  return supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY
  );
};
