/**
 * Get the canonical base URL for auth redirects.
 * This ensures OAuth always redirects to the production domain when available.
 */
export const getAuthRedirectBaseUrl = (): string => {
  // Check for explicit canonical URL configuration
  const canonicalUrl = import.meta.env.VITE_PUBLIC_SITE_URL || import.meta.env.VITE_CANONICAL_URL;
  
  if (canonicalUrl) {
    // Remove trailing slash if present
    return canonicalUrl.replace(/\/$/, '');
  }
  
  // For production domains, always use the canonical domain
  // This handles cases where user accesses via preview URL but should redirect to production
  const productionDomain = 'zunopropect.com.br';
  const currentOrigin = window.location.origin;
  
  // If we're on a lovableproject.com or supabase.co domain, redirect to production
  if (currentOrigin.includes('lovableproject.com') || currentOrigin.includes('supabase.co')) {
    return `https://${productionDomain}`;
  }
  
  // Otherwise, use current origin (for localhost dev, custom domains, etc.)
  return currentOrigin;
};

/**
 * Check if the current domain matches the canonical domain.
 * Useful for deciding whether to redirect after OAuth callback.
 */
export const isOnCanonicalDomain = (): boolean => {
  const canonicalBase = getAuthRedirectBaseUrl();
  return window.location.origin === canonicalBase;
};

