// supabase-client.js
// Frontend-safe Supabase configuration
// Uses Publishable Key + RLS (secure for browser)

window.SUPABASE_URL = "https://bvwnltducovnojfnlhji.supabase.co";
window.SUPABASE_ANON_KEY = "sb_publishable_-OsnXhn12GepRjo-iXxyjA_5KpIsUs1";

window.getSupabaseClient = function () {
  if (!window.supabase) {
    throw new Error("Supabase SDK not loaded");
  }

  return supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY
  );
};
