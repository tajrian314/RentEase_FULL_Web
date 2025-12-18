// Supabase Configuration
// This file is auto-generated from .env
// To update, edit .env and run: node load-env.js

const SUPABASE_URL = 'https://rffytsmzijylmesvrvxy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmZnl0c216aWp5bG1lc3Zydnh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4Njk0MzksImV4cCI6MjA4MDQ0NTQzOX0.RNvmeJij6SPG20aCO0TQSJzH33-L4azoEplxTAHjwj4';

// Initialize Supabase client
let supabase = null;

if (typeof window !== 'undefined') {
  // Check if the Supabase library is loaded
  // It effectively exposes 'supabase' (lowercase) usually, but we check 'Supabase' just in case.
  const SupabaseLib = window.supabase || window.Supabase;

  if (SupabaseLib && SupabaseLib.createClient) {
    try {
      // Initialize the client
      const client = SupabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

      // Expose globally as 'supabaseClient' (safe variable) to avoid conflicts
      window.supabaseClient = client;

      // Also overwrite 'window.supabase' to be the client, for backward compatibility
      window.supabase = client;

      // Update local variable
      supabase = client;

      console.log("✅ Supabase initialized");
    } catch (err) {
      console.error("❌ Error initializing Supabase:", err);
      alert("Error initializing Supabase. Check console for details.");
    }
  } else {
    console.error("❌ Supabase JS not loaded. Add this inside <head> or before closing </body>:");
    console.error(`<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>`);

    // Explicitly alert the user if library is missing
    setTimeout(() => {
      if (!window.supabaseClient) {
        alert("Critical Error: Supabase library failed to load. Please reload the page.");
      }
    }, 1000);
  }
}


// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { supabase, SUPABASE_URL, SUPABASE_ANON_KEY };
}
