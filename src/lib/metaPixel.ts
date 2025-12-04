// Meta Pixel IDs
export const FB_PIXEL_ID = '3431644540310424';
export const FB_PIXEL_ID_2 = '1395903565453591';

// Declare fbq for TypeScript
declare global {
  interface Window {
    fbq: any;
    _fbq: any;
  }
}

// Check if pixel is loaded
const isPixelLoaded = () => typeof window !== 'undefined' && typeof window.fbq === 'function';

// Track PageView
export const trackPageView = () => {
  if (isPixelLoaded()) {
    window.fbq('track', 'PageView');
  }
};

// Track ViewContent - when user views important content (e.g., pricing section)
export const trackViewContent = (params: {
  content_name?: string;
  content_category?: string;
  content_type?: string;
  value?: number;
  currency?: string;
}) => {
  if (isPixelLoaded()) {
    window.fbq('track', 'ViewContent', params);
  }
};

// Track Lead - when user shows interest (e.g., clicks on plan, starts signup)
export const trackLead = (params?: {
  content_name?: string;
  content_category?: string;
  value?: number;
  currency?: string;
}) => {
  if (isPixelLoaded()) {
    window.fbq('track', 'Lead', params);
  }
};

// Track InitiateCheckout - when user starts checkout process
export const trackInitiateCheckout = (params: {
  value?: number;
  currency?: string;
  content_name?: string;
  content_category?: string;
  num_items?: number;
}) => {
  if (isPixelLoaded()) {
    window.fbq('track', 'InitiateCheckout', params);
  }
};

// Track AddPaymentInfo - when user selects payment method
export const trackAddPaymentInfo = (params?: {
  content_category?: string;
  content_ids?: string[];
  currency?: string;
  value?: number;
}) => {
  if (isPixelLoaded()) {
    window.fbq('track', 'AddPaymentInfo', params);
  }
};

// Track Purchase - when payment is confirmed
export const trackPurchase = (params: {
  value: number;
  currency: string;
  content_name?: string;
  content_type?: string;
  content_ids?: string[];
  num_items?: number;
}) => {
  if (isPixelLoaded()) {
    window.fbq('track', 'Purchase', params);
  }
};

// Track CompleteRegistration - when user completes signup
export const trackCompleteRegistration = (params?: {
  content_name?: string;
  status?: string;
  value?: number;
  currency?: string;
}) => {
  if (isPixelLoaded()) {
    window.fbq('track', 'CompleteRegistration', params);
  }
};

// Custom Event: ExitIntent - when user is about to leave
export const trackExitIntent = (params: {
  page?: string;
  time_on_page?: number;
  last_action?: string;
}) => {
  if (isPixelLoaded()) {
    window.fbq('trackCustom', 'ExitIntent', params);
  }
};

// Custom Event: ScrollDepth - track how far user scrolled
export const trackScrollDepth = (params: {
  depth_percentage: number;
  page?: string;
}) => {
  if (isPixelLoaded()) {
    window.fbq('trackCustom', 'ScrollDepth', params);
  }
};
