import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface PlanInfo {
  key: string;
  name: string;
  revenueLimit: number;
  price: number;
}

interface SubscriptionStatus {
  plan: string;
  revenueLimit: number;
  revenueLimitBonus: number;
  monthlyRevenue: number;
  displayName: string;
  subscriptionEnd?: string;
  usagePercentage: number;
  isNearLimit: boolean;
  isAtLimit: boolean;
  recommendedPlan?: PlanInfo;
}

// Default fallback plans (used only when database is unavailable)
const DEFAULT_PLANS: PlanInfo[] = [
  { key: 'free', name: 'Plano Gratuito', revenueLimit: 2000, price: 0 },
  { key: 'basic', name: 'Plano Básico', revenueLimit: 10000, price: 99 },
  { key: 'growth', name: 'Plano Crescimento', revenueLimit: 30000, price: 149 },
  { key: 'pro', name: 'Plano Pro', revenueLimit: 50000, price: 199 },
];

function getRecommendedPlan(currentPlan: string, monthlyRevenue: number, plans: PlanInfo[]): PlanInfo | undefined {
  // Sort plans by revenue limit (ascending)
  const sortedPlans = [...plans].sort((a, b) => {
    if (a.revenueLimit === -1) return 1;
    if (b.revenueLimit === -1) return -1;
    return a.revenueLimit - b.revenueLimit;
  });

  const currentPlanInfo = sortedPlans.find(p => p.key === currentPlan);
  const currentLimit = currentPlanInfo?.revenueLimit || 0;

  for (const plan of sortedPlans) {
    // Skip the current plan
    if (plan.key === currentPlan) continue;
    
    // Skip plans with lower or equal limits (don't recommend downgrades)
    if (plan.revenueLimit !== -1 && plan.revenueLimit <= currentLimit) {
      continue;
    }
    
    // This plan can accommodate the revenue
    if (plan.revenueLimit === -1 || plan.revenueLimit > monthlyRevenue) {
      return plan;
    }
  }
  
  // If no suitable plan found, return the highest available
  return sortedPlans[sortedPlans.length - 1];
}

export function useSubscriptionStatus() {
  const { user } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Fetch subscription plans from database
      const { data: plansData } = await supabase
        .from('subscription_plans')
        .select('key, name, revenue_limit, price')
        .eq('is_active', true)
        .order('price', { ascending: true });

      const plans: PlanInfo[] = plansData?.map(p => ({
        key: p.key,
        name: p.name,
        revenueLimit: p.revenue_limit || 0,
        price: p.price,
      })) || DEFAULT_PLANS;

      // Dados locais da empresa para calcular uso
      const { data: company } = await supabase
        .from('companies')
        .select('monthly_revenue, subscription_status, subscription_plan, subscription_end_date')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (!company) {
        setLoading(false);
        return;
      }

      // Consulta a função do backend; QUALQUER erro/401 cai em fallback de plano grátis
      const { data: subscriptionData, error: subscriptionError } =
        await supabase.functions.invoke('check-subscription');

      const useFallback = !!subscriptionError || !subscriptionData;

      if (useFallback) {
        console.log('Subscription check failed or empty (treated as free plan):', subscriptionError);
        const monthlyRevenue = company.monthly_revenue || 0;
        const currentPlan = company.subscription_plan || 'free';
        
        // Get plan info from database plans
        const planInfo = plans.find(p => p.key === currentPlan);
        const revenueLimit = planInfo?.revenueLimit || 2000;
        const displayName = planInfo?.name || 'Plano Gratuito';
        
        const usagePercentage =
          revenueLimit === -1 ? 0 : (monthlyRevenue / revenueLimit) * 100;
        
        const isNearLimit = revenueLimit !== -1 && usagePercentage >= 80 && usagePercentage < 100;
        const isAtLimit = revenueLimit !== -1 && usagePercentage >= 100;
        const recommendedPlan = (isNearLimit || isAtLimit) ? getRecommendedPlan(currentPlan, monthlyRevenue, plans) : undefined;

        setStatus({
          plan: currentPlan,
          revenueLimit,
          revenueLimitBonus: 0,
          monthlyRevenue,
          displayName,
          subscriptionEnd: company.subscription_end_date || undefined,
          usagePercentage,
          isNearLimit,
          isAtLimit,
          recommendedPlan,
        });
        return;
      }

      const typedSubscriptionData = (subscriptionData || {}) as {
        plan?: string;
        revenueLimit?: number;
        revenueLimitBonus?: number;
        displayName?: string;
        subscriptionEnd?: string;
      };

      const monthlyRevenue = company.monthly_revenue || 0;
      const currentPlan = typedSubscriptionData.plan || 'free';
      const revenueLimit = typedSubscriptionData.revenueLimit || 2000;
      const usagePercentage =
        revenueLimit === -1 ? 0 : (monthlyRevenue / revenueLimit) * 100;
      
      const isNearLimit = revenueLimit !== -1 && usagePercentage >= 80 && usagePercentage < 100;
      const isAtLimit = revenueLimit !== -1 && usagePercentage >= 100;
      const recommendedPlan = (isNearLimit || isAtLimit) ? getRecommendedPlan(currentPlan, monthlyRevenue, plans) : undefined;

      setStatus({
        plan: currentPlan,
        revenueLimit,
        revenueLimitBonus: typedSubscriptionData.revenueLimitBonus || 0,
        monthlyRevenue,
        displayName: typedSubscriptionData.displayName || 'Plano Gratuito',
        subscriptionEnd: typedSubscriptionData.subscriptionEnd,
        usagePercentage,
        isNearLimit,
        isAtLimit,
        recommendedPlan,
      });
    } catch (error) {
      console.error('Error fetching subscription status (hard-fallback to free plan):', error);
      setStatus({
        plan: 'free',
        revenueLimit: 2000,
        revenueLimitBonus: 0,
        monthlyRevenue: 0,
        displayName: 'Plano Gratuito',
        usagePercentage: 0,
        isNearLimit: false,
        isAtLimit: false,
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { status, loading, refetch: fetchStatus };
}
