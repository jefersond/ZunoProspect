import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://placeholder-project.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder";

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  if (import.meta.env.DEV) {
    console.warn("⚠️ [AVISO] Variáveis VITE_SUPABASE_URL ou VITE_SUPABASE_PUBLISHABLE_KEY não configuradas. Operando com cliente dummy seguro.");
  }
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