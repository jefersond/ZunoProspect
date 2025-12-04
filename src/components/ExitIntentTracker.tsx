import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackExitIntent } from '@/lib/metaPixel';

export function ExitIntentTracker() {
  const location = useLocation();
  const pageLoadTime = useRef(Date.now());
  const hasTriggered = useRef(false);

  useEffect(() => {
    // Reset on route change
    pageLoadTime.current = Date.now();
    hasTriggered.current = false;
  }, [location.pathname]);

  useEffect(() => {
    // Desktop: detect mouse leaving window (top of screen)
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !hasTriggered.current) {
        hasTriggered.current = true;
        const timeOnPage = Math.round((Date.now() - pageLoadTime.current) / 1000);
        trackExitIntent({
          page: location.pathname,
          time_on_page: timeOnPage,
          last_action: 'mouse_leave'
        });
      }
    };

    // Mobile/Tab: detect visibility change (user switching tabs or closing)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && !hasTriggered.current) {
        hasTriggered.current = true;
        const timeOnPage = Math.round((Date.now() - pageLoadTime.current) / 1000);
        trackExitIntent({
          page: location.pathname,
          time_on_page: timeOnPage,
          last_action: 'visibility_hidden'
        });
      }
    };

    // Add event listeners
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [location.pathname]);

  return null;
}
