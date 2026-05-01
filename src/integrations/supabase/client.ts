import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables. Check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
}

console.log("SUPABASE URL EM USO:", import.meta.env.VITE_SUPABASE_URL);

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});

if (import.meta.env.DEV) {
  console.log("🛠️ [DEV DEBUG] Supabase URL configurada:", supabaseUrl);
  console.log("🛠️ [DEV DEBUG] Anon key existe?", !!supabaseAnonKey);
  
  supabase.auth.onAuthStateChange((event, session) => {
    console.log("🛠️ [DEV DEBUG] Evento de auth recebido:", event);
    if (session?.user) {
      console.log("🛠️ [DEV DEBUG] User ID autenticado:", session.user.id);
    }
  });
}