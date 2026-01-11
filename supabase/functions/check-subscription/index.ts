import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");

    // If there's no auth header, treat user as not authenticated and return free plan.
    if (!authHeader) {
      logStep("No authorization header - returning free plan");
      return new Response(
        JSON.stringify({
          subscribed: false,
          plan: "free",
          revenueLimit: 2000,
          displayName: "Plano Gratuito",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);

    // If the token is invalid/revoked ("session not found" etc), do NOT crash the app.
    // Return free plan as a safe fallback.
    if (userError || !userData.user?.email) {
      logStep("User not authenticated - returning free plan", { userError: userError?.message });
      return new Response(
        JSON.stringify({
          subscribed: false,
          plan: "free",
          revenueLimit: 2000,
          displayName: "Plano Gratuito",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const user = userData.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    // FIRST: Check company's current subscription status from database
    // This handles Mercado Pago subscriptions that don't use Stripe
    const { data: company, error: companyError } = await adminClient
      .from("companies")
      .select("id, subscription_status, subscription_plan, subscription_end_date, revenue_limit_bonus")
      .eq("owner_id", user.id)
      .maybeSingle();
    
    // Get the bonus amount (default to 0 if not set)
    const revenueLimitBonus = Number(company?.revenue_limit_bonus) || 0;

    if (companyError) {
      logStep("Error fetching company", { error: companyError.message });
    }

    // If company has an active subscription in the database, use it directly
    // This is for Mercado Pago subscriptions
    if (company?.subscription_status === "active" && company?.subscription_plan) {
      const subscriptionEnd = company.subscription_end_date;
      
      // Check if subscription is still valid (not expired)
      const isExpired = subscriptionEnd && new Date(subscriptionEnd) < new Date();
      
      if (!isExpired) {
        // Get plan details from database
        const { data: plan } = await adminClient
          .from("subscription_plans")
          .select("key, name, revenue_limit")
          .eq("key", company.subscription_plan)
          .eq("is_active", true)
          .maybeSingle();

        if (plan) {
          // Apply bonus to revenue limit
          const effectiveLimit = (plan.revenue_limit || 5000) + revenueLimitBonus;
          
          logStep("Active subscription found in database (Mercado Pago)", {
            plan: plan.key,
            subscriptionEnd,
            baseLimit: plan.revenue_limit,
            bonus: revenueLimitBonus,
            effectiveLimit
          });

          return new Response(
            JSON.stringify({
              subscribed: true,
              plan: plan.key,
              revenueLimit: effectiveLimit,
              revenueLimitBonus,
              displayName: plan.name,
              subscriptionEnd,
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        }
      } else {
        // Subscription expired - reset to free
        logStep("Subscription expired, resetting to free", { subscriptionEnd });
        await adminClient
          .from("companies")
          .update({
            subscription_status: "free",
            subscription_plan: null,
            subscription_end_date: null,
          })
          .eq("id", company.id);
      }
    }

    // SECOND: Check Stripe for active subscriptions
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    
    // If no Stripe key configured, return based on database status or free
    if (!stripeKey) {
      logStep("No Stripe key configured - checking database only");
      
      if (company?.subscription_plan) {
        const { data: plan } = await adminClient
          .from("subscription_plans")
          .select("key, name, revenue_limit")
          .eq("key", company.subscription_plan)
          .eq("is_active", true)
          .maybeSingle();

        if (plan) {
          const effectiveLimit = (plan.revenue_limit || 2000) + revenueLimitBonus;
          return new Response(
            JSON.stringify({
              subscribed: company.subscription_status === "active",
              plan: plan.key,
              revenueLimit: effectiveLimit,
              revenueLimitBonus,
              displayName: plan.name,
              subscriptionEnd: company.subscription_end_date,
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        }
      }

      return new Response(
        JSON.stringify({
          subscribed: false,
          plan: "free",
          revenueLimit: 2000 + revenueLimitBonus,
          revenueLimitBonus,
          displayName: "Plano Gratuito",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    // Find customer in Stripe
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No Stripe customer found - using free plan");
      return new Response(JSON.stringify({
        subscribed: false,
        plan: "free",
        revenueLimit: 2000 + revenueLimitBonus,
        revenueLimitBonus,
        displayName: "Plano Gratuito",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Stripe customer found", { customerId });

    // Check Stripe subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      logStep("No active Stripe subscription - checking if Mercado Pago subscription exists");
      
      // DON'T reset the database if there's no Stripe subscription
      // The user might have a Mercado Pago subscription
      // We already checked the database above, so just return free plan
      
      return new Response(JSON.stringify({
        subscribed: false,
        plan: "free",
        revenueLimit: 2000 + revenueLimitBonus,
        revenueLimitBonus,
        displayName: "Plano Gratuito",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const subscription = subscriptions.data[0];
    const price = subscription.items.data[0].price;
    const productId = price.product as string | undefined;
    const priceId = price.id as string | undefined;
    const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();

    logStep("Active Stripe subscription found", { productId, priceId, subscriptionEnd });

    // Fetch plan from subscription_plans table
    const { data: plan, error: planError } = await adminClient
      .from("subscription_plans")
      .select("key, name, revenue_limit, stripe_product_id, stripe_price_id")
      .or(
        [
          productId ? `stripe_product_id.eq.${productId}` : "",
          priceId ? `stripe_price_id.eq.${priceId}` : "",
        ]
          .filter(Boolean)
          .join(",")
      )
      .eq("is_active", true)
      .maybeSingle();

    if (planError) {
      logStep("Error fetching subscription plan from DB", { message: planError.message });
    }

    const effectivePlanName = plan?.key || plan?.name || "unknown";
    const basePlanLimit = typeof plan?.revenue_limit === "number" ? plan.revenue_limit : 10000;
    const effectiveRevenueLimit = basePlanLimit + revenueLimitBonus;

    // Update company with Stripe subscription info
    if (company?.id) {
      await adminClient
        .from("companies")
        .update({
          subscription_status: "active",
          subscription_plan: effectivePlanName,
          subscription_end_date: subscriptionEnd,
          stripe_customer_id: customerId,
        })
        .eq("id", company.id);
    }

    return new Response(
      JSON.stringify({
        subscribed: true,
        plan: effectivePlanName,
        revenueLimit: effectiveRevenueLimit,
        revenueLimitBonus,
        displayName: plan?.name || "Plano Desconhecido",
        subscriptionEnd,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
