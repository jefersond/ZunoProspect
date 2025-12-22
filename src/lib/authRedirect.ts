/**
 * Canonical domain for production OAuth redirects.
 * This ensures OAuth always redirects to the correct production domain.
 */
const CANONICAL_DOMAIN = 'https://zunopropect.com.br';

/**
 * Get the canonical base URL for auth redirects.
 * Priority:
 * 1. VITE_PUBLIC_SITE_URL environment variable (if set)
 * 2. Hardcoded canonical domain for production
 * 3. Current origin for localhost development
 */
export const getAuthRedirectBaseUrl = (): string => {
  // Check for explicit canonical URL configuration
  const envCanonicalUrl = import.meta.env.VITE_PUBLIC_SITE_URL;
  
  if (envCanonicalUrl) {
    // Remove trailing slash if present
    return envCanonicalUrl.replace(/\/$/, '');
  }
  
  const currentOrigin = window.location.origin;
  
  // For localhost, use current origin (dev environment)
  if (currentOrigin.includes('localhost') || currentOrigin.includes('127.0.0.1')) {
    return currentOrigin;
  }
  
  // For all other cases (preview, production), always use canonical domain
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

