import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const processPendingReferral = async (userId: string) => {
      const pendingReferral = localStorage.getItem("pending_referral");
      if (!pendingReferral) return;

      try {
        await supabase.rpc("apply_referral_code", {
          p_user_id: userId,
          p_referral_code: pendingReferral,
        });
      } catch (error) {
        console.error("Erro ao processar indicação:", error);
      } finally {
        localStorage.removeItem("pending_referral");
      }
    };

    const loadSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          console.error("Erro ao carregar sessão:", error.message);
        }

        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);

        if (data.session?.user) {
          await processPendingReferral(data.session.user.id);
        }
      } catch (err) {
        console.error("Exceção ao carregar sessão:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);

      if (newSession?.user) {
        await processPendingReferral(newSession.user.id);
      }
    });

    loadSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Erro ao fazer logoff", err);
    } finally {
      setSession(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
