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
  const envCanonicalUrl = import.meta.env.VITE_PUBLIC_SITE_URL;
  if (envCanonicalUrl) return envCanonicalUrl.replace(/\/$/, '');

  const currentOrigin = window.location.origin;

  // Dev
  if (currentOrigin.includes('localhost') || currentOrigin.includes('127.0.0.1')) {
    return currentOrigin;
  }

  // Lovable preview domains should redirect back to themselves
  // (otherwise OAuth can land on an unconfigured/empty domain).
  const isLovablePreview =
    currentOrigin.includes('lovable.app') ||
    currentOrigin.includes('lovableproject.com') ||
    currentOrigin.includes('lovable.dev');

  if (isLovablePreview) {
    return currentOrigin;
  }

  // Production
  return CANONICAL_DOMAIN;
};

/**
 * Check if the current domain matches the canonical domain.
 * Useful for deciding whether to redirect after OAuth callback.
 */
export const isOnCanonicalDomain = (): boolean => {
  const currentOrigin = window.location.origin;

  // Localhost is always considered "canonical" for dev
  if (currentOrigin.includes('localhost') || currentOrigin.includes('127.0.0.1')) {
    return true;
  }

  const canonicalBase = getAuthRedirectBaseUrl();
  return currentOrigin === canonicalBase;
};


