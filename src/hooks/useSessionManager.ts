import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';

interface UseSessionManagerOptions {
  /** Interval in minutes to check session freshness (default: 5) */
  checkInterval?: number;
  /** Time in minutes before expiry to trigger refresh (default: 10) */
  refreshThreshold?: number;
  /** Callback when session is refreshed */
  onSessionRefreshed?: (session: Session) => void;
  /** Callback when session expires and user needs to re-login */
  onSessionExpired?: () => void;
}

/**
 * Hook to manage automatic session refresh
 * Prevents authentication errors during prolonged use
 */
export function useSessionManager(options: UseSessionManagerOptions = {}) {
  const {
    checkInterval = 5,
    refreshThreshold = 10,
    onSessionRefreshed,
    onSessionExpired,
  } = options;

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRefreshingRef = useRef(false);

  const refreshSession = useCallback(async () => {
    if (isRefreshingRef.current) return;
    
    isRefreshingRef.current = true;
    
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('❌ Session refresh failed:', error.message);
        
        // If refresh fails, check if session is completely expired
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession) {
          console.warn('⚠️ Session expired, user needs to re-login');
          onSessionExpired?.();
        }
        return;
      }

      if (session) {
        console.log('✅ Session refreshed successfully');
        onSessionRefreshed?.(session);
      }
    } catch (err) {
      console.error('❌ Unexpected error refreshing session:', err);
    } finally {
      isRefreshingRef.current = false;
    }
  }, [onSessionRefreshed, onSessionExpired]);

  const checkAndRefreshSession = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.warn('⚠️ No active session');
        onSessionExpired?.();
        return;
      }

      // Check if token is close to expiring
      const expiresAt = session.expires_at;
      if (!expiresAt) return;

      const expiresAtMs = expiresAt * 1000;
      const now = Date.now();
      const minutesUntilExpiry = (expiresAtMs - now) / (1000 * 60);

      console.log(`🔐 Session check: ${Math.round(minutesUntilExpiry)} minutes until expiry`);

      // Refresh if within threshold
      if (minutesUntilExpiry <= refreshThreshold) {
        console.log('🔄 Proactively refreshing session...');
        await refreshSession();
      }
    } catch (err) {
      console.error('❌ Error checking session:', err);
    }
  }, [refreshThreshold, refreshSession, onSessionExpired]);

  // Set up periodic session check
  useEffect(() => {
    // Initial check
    checkAndRefreshSession();

    // Set up interval
    intervalRef.current = setInterval(
      checkAndRefreshSession,
      checkInterval * 60 * 1000
    );

    // Also refresh on window focus (user returning to tab)
    const handleFocus = () => {
      console.log('👀 Window focused, checking session...');
      checkAndRefreshSession();
    };

    // Refresh before user performs important actions
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAndRefreshSession();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkInterval, checkAndRefreshSession]);

  return {
    refreshSession,
    checkAndRefreshSession,
  };
}
