import { useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Generate or retrieve a session ID for this browser session
const getSessionId = (): string => {
  const key = 'promotion_session_id';
  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(key, sessionId);
  }
  return sessionId;
};

interface TrackEventParams {
  promotionId: string;
  companyId: string;
  eventType: 'view' | 'click' | 'conversion';
  orderId?: string;
  revenue?: number;
}

export function usePromotionTracking() {
  const trackedViews = useRef<Set<string>>(new Set());

  const trackEvent = useCallback(async ({
    promotionId,
    companyId,
    eventType,
    orderId,
    revenue,
  }: TrackEventParams) => {
    try {
      const sessionId = getSessionId();

      // For views, avoid tracking the same promotion multiple times in this session
      if (eventType === 'view') {
        const viewKey = `${promotionId}-${sessionId}`;
        if (trackedViews.current.has(viewKey)) {
          console.log(`[PromotionTracking] View already tracked for promotion ${promotionId}, skipping`);
          return; // Already tracked this view
        }
        trackedViews.current.add(viewKey);
      }

      console.log(`[PromotionTracking] Tracking ${eventType} for promotion ${promotionId}, company ${companyId}`);

      const { data, error } = await supabase.functions.invoke('track-promotion-event', {
        body: {
          promotion_id: promotionId,
          company_id: companyId,
          event_type: eventType,
          order_id: orderId,
          revenue: revenue,
          session_id: sessionId,
        },
      });

      if (error) {
        console.error('[PromotionTracking] Error tracking event:', error);
      } else {
        console.log(`[PromotionTracking] Event tracked successfully:`, data);
      }
    } catch (err) {
      console.error('[PromotionTracking] Failed to track event:', err);
    }
  }, []);

  const trackView = useCallback((promotionId: string, companyId: string) => {
    trackEvent({ promotionId, companyId, eventType: 'view' });
  }, [trackEvent]);

  const trackClick = useCallback((promotionId: string, companyId: string) => {
    trackEvent({ promotionId, companyId, eventType: 'click' });
  }, [trackEvent]);

  const trackConversion = useCallback((promotionId: string, companyId: string, orderId: string, revenue: number) => {
    trackEvent({ promotionId, companyId, eventType: 'conversion', orderId, revenue });
  }, [trackEvent]);

  return {
    trackEvent,
    trackView,
    trackClick,
    trackConversion,
  };
}

// Hook for tracking views when promotions become visible
export function useTrackPromotionViews(
  promotions: Array<{ id: string }>,
  companyId: string | undefined,
  enabled: boolean = true
) {
  const { trackView } = usePromotionTracking();
  const hasTracked = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || !companyId || promotions.length === 0) return;

    // Track views for all visible promotions
    promotions.forEach((promo) => {
      if (!hasTracked.current.has(promo.id)) {
        hasTracked.current.add(promo.id);
        trackView(promo.id, companyId);
      }
    });
  }, [promotions, companyId, enabled, trackView]);
}

/**
 * Helper to track conversions for all promotions applied to cart items.
 * Call this when an order is successfully completed/paid.
 */
export async function trackCartConversions(
  items: Array<{ promotionId?: string; price: number; quantity: number; options: { priceModifier: number }[] }>,
  companyId: string,
  orderId: string
) {
  const sessionId = sessionStorage.getItem('promotion_session_id') || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Group items by promotionId and calculate revenue per promotion
  const promotionRevenue = new Map<string, number>();
  
  items.forEach((item) => {
    if (item.promotionId) {
      const itemTotal = (item.price + item.options.reduce((s, o) => s + o.priceModifier, 0)) * item.quantity;
      const current = promotionRevenue.get(item.promotionId) || 0;
      promotionRevenue.set(item.promotionId, current + itemTotal);
    }
  });

  // Track conversion for each promotion
  const promises = Array.from(promotionRevenue.entries()).map(async ([promotionId, revenue]) => {
    try {
      console.log(`[PromotionTracking] Tracking conversion for promotion ${promotionId}, order ${orderId}, revenue ${revenue}`);
      
      const { data, error } = await (await import('@/integrations/supabase/client')).supabase.functions.invoke('track-promotion-event', {
        body: {
          promotion_id: promotionId,
          company_id: companyId,
          event_type: 'conversion',
          order_id: orderId,
          revenue: revenue,
          session_id: sessionId,
        },
      });

      if (error) {
        console.error('[PromotionTracking] Error tracking conversion:', error);
      } else {
        console.log('[PromotionTracking] Conversion tracked successfully:', data);
      }
    } catch (err) {
      console.error('[PromotionTracking] Failed to track conversion:', err);
    }
  });

  await Promise.all(promises);
}
