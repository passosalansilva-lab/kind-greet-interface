import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidateReferralRequest {
  companyId: string;
  referralCode: string;
  customerEmail?: string;
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

    const { companyId, referralCode, customerEmail } = await req.json() as ValidateReferralRequest;

    console.log('Validating referral code:', { companyId, referralCode, customerEmail });

    if (!companyId || !referralCode) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Missing required fields' }),
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
      console.log('Referral settings not found');
      return new Response(
        JSON.stringify({ valid: false, error: 'Programa de indicação não configurado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!settings.is_enabled) {
      console.log('Referral program is disabled');
      return new Response(
        JSON.stringify({ valid: false, error: 'Programa de indicação desativado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Find the referral code
    const { data: referralCodeData, error: codeError } = await supabase
      .from('customer_referral_codes')
      .select('*, customers!customer_referral_codes_customer_id_fkey(name, email)')
      .eq('company_id', companyId)
      .eq('code', referralCode.toUpperCase())
      .single();

    if (codeError || !referralCodeData) {
      console.log('Referral code not found');
      return new Response(
        JSON.stringify({ valid: false, error: 'Código de indicação inválido' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Check if customer is trying to use their own code (if we have their email)
    if (customerEmail && referralCodeData.customers?.email?.toLowerCase() === customerEmail.toLowerCase()) {
      console.log('Customer trying to use own code');
      return new Response(
        JSON.stringify({ valid: false, error: 'Você não pode usar seu próprio código de indicação' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Check if referrer has exceeded their max referrals
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
        JSON.stringify({ valid: false, error: 'Este código de indicação atingiu o limite de uso' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. If we have customerEmail, check if this customer already used a referral
    if (customerEmail) {
      // Find customer by email
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('email', customerEmail.toLowerCase())
        .single();

      if (customer) {
        const { data: existingUsage } = await supabase
          .from('customer_referral_usage')
          .select('id')
          .eq('company_id', companyId)
          .eq('referred_customer_id', customer.id);

        const usageCount = existingUsage?.length || 0;
        const maxUsesPerReferred = settings.max_uses_per_referred || 1;

        if (usageCount >= maxUsesPerReferred) {
          console.log(`Customer already used ${usageCount} referrals`);
          return new Response(
            JSON.stringify({ valid: false, error: 'Você já utilizou o limite de descontos por indicação' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Valid!
    const referrerName = referralCodeData.customers?.name || 'Um amigo';
    const discountPercent = settings.referred_discount_percent || 10;

    console.log('Referral code is valid');

    return new Response(
      JSON.stringify({
        valid: true,
        discountPercent,
        referrerName,
        referralCodeId: referralCodeData.id,
        referrerId: referralCodeData.customer_id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error validating referral code:', error);
    return new Response(
      JSON.stringify({ valid: false, error: 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
