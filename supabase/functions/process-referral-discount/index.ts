import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessReferralRequest {
  companyId: string;
  referralCode: string;
  referredCustomerId: string;
  orderId: string;
  orderTotal: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { companyId, referralCode, referredCustomerId, orderId, orderTotal } = await req.json() as ProcessReferralRequest;

    console.log('Processing referral:', { companyId, referralCode, referredCustomerId, orderId, orderTotal });

    if (!companyId || !referralCode || !referredCustomerId || !orderId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Get referral settings for the company
    const { data: settings, error: settingsError } = await supabase
      .from('customer_referral_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (settingsError || !settings) {
      console.error('Settings not found:', settingsError);
      return new Response(
        JSON.stringify({ error: 'Referral program not configured', processed: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!settings.is_enabled) {
      console.log('Referral program is disabled');
      return new Response(
        JSON.stringify({ error: 'Referral program is disabled', processed: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Find the referral code
    const { data: referralCodeData, error: codeError } = await supabase
      .from('customer_referral_codes')
      .select('*')
      .eq('company_id', companyId)
      .eq('code', referralCode.toUpperCase())
      .single();

    if (codeError || !referralCodeData) {
      console.error('Referral code not found:', codeError);
      return new Response(
        JSON.stringify({ error: 'Invalid referral code', processed: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Check if referrer is the same as referred (can't use own code)
    if (referralCodeData.customer_id === referredCustomerId) {
      console.log('Customer trying to use own referral code');
      return new Response(
        JSON.stringify({ error: 'Cannot use your own referral code', processed: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Check if referred customer already used a referral code (max_uses_per_referred)
    const { data: existingUsage, error: usageError } = await supabase
      .from('customer_referral_usage')
      .select('id')
      .eq('company_id', companyId)
      .eq('referred_customer_id', referredCustomerId);

    if (usageError) {
      console.error('Error checking existing usage:', usageError);
    }

    const usageCount = existingUsage?.length || 0;
    const maxUsesPerReferred = settings.max_uses_per_referred || 1;

    if (usageCount >= maxUsesPerReferred) {
      console.log(`Customer already used ${usageCount} referrals, max is ${maxUsesPerReferred}`);
      return new Response(
        JSON.stringify({ error: 'You have already used the maximum number of referral discounts', processed: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Check if referrer has exceeded their max referrals
    const { data: referrerUsages, error: referrerUsageError } = await supabase
      .from('customer_referral_usage')
      .select('id')
      .eq('referral_code_id', referralCodeData.id);

    if (referrerUsageError) {
      console.error('Error checking referrer usage:', referrerUsageError);
    }

    const referrerUsageCount = referrerUsages?.length || 0;
    const maxUsesPerReferrer = settings.max_uses_per_referrer || 10;

    if (referrerUsageCount >= maxUsesPerReferrer) {
      console.log(`Referrer has ${referrerUsageCount} referrals, max is ${maxUsesPerReferrer}`);
      return new Response(
        JSON.stringify({ error: 'This referral code has reached its maximum usage limit', processed: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Calculate discounts
    const referredDiscountPercent = settings.referred_discount_percent || 10;
    const referrerDiscountPercent = settings.referrer_discount_percent || 10;

    const referredDiscount = (orderTotal * referredDiscountPercent) / 100;
    const referrerCreditAmount = (orderTotal * referrerDiscountPercent) / 100;

    console.log('Calculated discounts:', { referredDiscount, referrerCreditAmount });

    // 7. Record the referral usage
    const { data: usageRecord, error: insertUsageError } = await supabase
      .from('customer_referral_usage')
      .insert({
        company_id: companyId,
        referral_code_id: referralCodeData.id,
        referred_customer_id: referredCustomerId,
        order_id: orderId,
        discount_applied: referredDiscount,
        referrer_discount_applied: referrerCreditAmount,
      })
      .select()
      .single();

    if (insertUsageError) {
      console.error('Error recording referral usage:', insertUsageError);
      return new Response(
        JSON.stringify({ error: 'Failed to record referral usage', processed: false }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Create credit for the referrer (to be used on their next order)
    const { error: creditError } = await supabase
      .from('customer_referral_credits')
      .insert({
        company_id: companyId,
        customer_id: referralCodeData.customer_id,
        amount: referrerCreditAmount,
        remaining_amount: referrerCreditAmount,
        source_referral_id: usageRecord.id,
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
      });

    if (creditError) {
      console.error('Error creating referrer credit:', creditError);
      // Don't fail the whole operation, just log
    }

    // 9. Update referral code stats
    const { error: updateCodeError } = await supabase
      .from('customer_referral_codes')
      .update({
        total_referrals: (referralCodeData.total_referrals || 0) + 1,
        total_discount_given: (referralCodeData.total_discount_given || 0) + referredDiscount,
      })
      .eq('id', referralCodeData.id);

    if (updateCodeError) {
      console.error('Error updating referral code stats:', updateCodeError);
    }

    console.log('Referral processed successfully');

    return new Response(
      JSON.stringify({
        processed: true,
        referredDiscount,
        referrerCreditAmount,
        message: 'Referral processed successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing referral:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', processed: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
