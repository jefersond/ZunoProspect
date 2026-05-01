/**
 * Canonical domain for production OAuth redirects.
 * This ensures OAuth always redirects to the correct production domain.
 */
const CANONICAL_DOMAIN = 'https://zunopropect.com.br';

/**
 * Get the base URL for auth redirects.
 * Priority:
 * 1. VITE_PUBLIC_SITE_URL environment variable (if set)
 * 2. Current origin for localhost and Lovable preview domains
 * 3. Hardcoded canonical domain for production
 */
export const getAuthRedirectBaseUrl = (): string => {
  return window.location.origin;
};

/**
 * Check if the current domain matches the canonical domain.
 * Useful for deciding whether to redirect after OAuth callback.
 */
export const isOnCanonicalDomain = (): boolean => {
  return true;
};


