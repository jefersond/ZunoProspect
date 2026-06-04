import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isAdminUser } from "@/config/admin";
import { clearReferralCode, getStoredReferralCode, shouldApplyReferralForUser } from "@/lib/referral";
import { syncAttributionToProfile } from "@/lib/tracking";

type AuthProfile = {
  id?: string | null;
  email?: string | null;
  role?: string | null;
  is_admin?: boolean | null;
  [key: string]: unknown;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  authLoading: boolean;
  profile: AuthProfile | null;
  profileLoading: boolean;
  profileError: string | null;
  isAdmin: boolean;
  adminReady: boolean;
  refetchProfile: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const processPendingReferral = useCallback(async (currentUser: User) => {
    const pendingReferral = getStoredReferralCode();
    if (!pendingReferral) return;

    if (!shouldApplyReferralForUser(currentUser.created_at)) {
      clearReferralCode();
      return;
    }

    try {
      const { error } = await supabase.rpc("apply_referral_code", {
        p_user_id: currentUser.id,
        p_referral_code: pendingReferral,
      });
      if (error) throw error;
      clearReferralCode();
    } catch (error) {
      console.error("Erro ao processar indicacao:", error);
    }
  }, []);

  const applySession = useCallback((nextSession: Session | null) => {
    const nextUser = nextSession?.user ?? null;

    setSession(nextSession);
    setUser(nextUser);
    setIsAdmin(isAdminUser(nextUser));

    if (!nextUser) {
      setProfile(null);
      setProfileError(null);
      setProfileLoading(false);
    }
  }, []);

  const loadProfile = useCallback(async (targetUser: User | null) => {
    if (!targetUser) return;

    setProfileLoading(true);
    setProfileError(null);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", targetUser.id)
        .maybeSingle();

      if (error) throw error;

      const nextProfile = (data ?? null) as AuthProfile | null;
      setProfile(nextProfile);
      setIsAdmin(isAdminUser(targetUser, nextProfile));
    } catch (err: any) {
      console.warn("[AuthProvider] Falha ao carregar profile:", err?.message || err);
      setProfile(null);
      setProfileError(err?.message || "Falha ao carregar profile.");
      setIsAdmin(isAdminUser(targetUser));
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const runPostLoginTasks = useCallback((currentUser: User) => {
    void Promise.all([
      processPendingReferral(currentUser),
      syncAttributionToProfile(currentUser.id),
    ]);
  }, [processPendingReferral]);

  const refreshPermissions = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      applySession(data.session ?? null);

      if (data.session?.user) {
        await loadProfile(data.session.user);
      }
    } catch (err: any) {
      console.error("[AuthProvider] Erro ao recarregar permissoes:", err?.message || err);
      setProfileError(err?.message || "Falha ao recarregar permissoes.");
    } finally {
      setLoading(false);
    }
  }, [applySession, loadProfile]);

  const refetchProfile = useCallback(async () => {
    await loadProfile(user);
  }, [loadProfile, user]);

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          console.error("Erro ao carregar sessao:", error.message);
        }

        applySession(data.session ?? null);

        if (data.session?.user) {
          void loadProfile(data.session.user);
          runPostLoginTasks(data.session.user);
        }
      } catch (err) {
        console.error("Excecao ao carregar sessao:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      applySession(nextSession);
      setLoading(false);

      if (event === "SIGNED_OUT") {
        return;
      }

      if (
        nextSession?.user &&
        ["INITIAL_SESSION", "SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"].includes(event)
      ) {
        void loadProfile(nextSession.user);
        runPostLoginTasks(nextSession.user);
      }
    });

    loadSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [applySession, loadProfile, runPostLoginTasks]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Erro ao fazer logoff", err);
    } finally {
      applySession(null);
      setLoading(false);
    }
  };

  const adminReady = useMemo(() => isAdminUser(user, profile) || isAdmin, [isAdmin, profile, user]);

  const value = useMemo(
    () => ({
      session,
      user,
      loading,
      authLoading: loading,
      profile,
      profileLoading,
      profileError,
      isAdmin: adminReady,
      adminReady,
      refetchProfile,
      refreshPermissions,
      signOut,
    }),
    [adminReady, loading, profile, profileError, profileLoading, refetchProfile, refreshPermissions, session, user],
  );

  return (
    <AuthContext.Provider value={value}>
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
