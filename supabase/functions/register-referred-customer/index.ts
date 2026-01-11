import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RegisterReferredCustomerRequest {
  email: string;
  name: string;
  phone?: string;
  referralCode: string;
  companyId: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, name, phone, referralCode, companyId } = await req.json() as RegisterReferredCustomerRequest;

    console.log('[REGISTER-REFERRED] Request:', { email, name, referralCode, companyId });

    if (!email || !name || !referralCode || !companyId) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios faltando' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';

    // 1. Check if referral program is enabled
    const { data: settings, error: settingsError } = await supabase
      .from('customer_referral_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (settingsError || !settings || !settings.is_enabled) {
      console.log('[REGISTER-REFERRED] Referral program not enabled');
      return new Response(
        JSON.stringify({ error: 'Programa de indicação não está ativo' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Find the referral code
    const { data: referralCodeData, error: codeError } = await supabase
      .from('customer_referral_codes')
      .select('*, customers!customer_referral_codes_customer_id_fkey(id, name, email)')
      .eq('company_id', companyId)
      .eq('code', referralCode.toUpperCase())
      .single();

    if (codeError || !referralCodeData) {
      console.log('[REGISTER-REFERRED] Invalid referral code:', referralCode);
      return new Response(
        JSON.stringify({ error: 'Código de indicação inválido' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Check if the referrer's email is the same as the new customer
    if (referralCodeData.customers?.email?.toLowerCase() === normalizedEmail) {
      console.log('[REGISTER-REFERRED] Cannot use own referral code');
      return new Response(
        JSON.stringify({ error: 'Você não pode usar seu próprio código de indicação' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Check if customer already exists
    let customerId: string | null = null;
    let isNewCustomer = false;

    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id, email')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingCustomer) {
      customerId = existingCustomer.id;
      console.log('[REGISTER-REFERRED] Customer already exists:', customerId);
      
      // Check if they already used a referral
      const { data: existingUsage } = await supabase
        .from('customer_referral_usage')
        .select('id')
        .eq('company_id', companyId)
        .eq('referred_customer_id', customerId);

      const usageCount = existingUsage?.length || 0;
      const maxUsesPerReferred = settings.max_uses_per_referred || 1;

      if (usageCount >= maxUsesPerReferred) {
        console.log('[REGISTER-REFERRED] Customer already used referral discount');
        return new Response(
          JSON.stringify({ 
            error: 'Você já utilizou o limite de descontos por indicação',
            customerId,
            customerName: name,
            customerEmail: normalizedEmail,
            customerPhone: cleanPhone,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Create new customer
      const { data: newCustomer, error: insertError } = await supabase
        .from('customers')
        .insert({
          name: name.trim(),
          email: normalizedEmail,
          phone: cleanPhone,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('[REGISTER-REFERRED] Error creating customer:', insertError);
        
        // Handle duplicate key error
        if (insertError.code === '23505') {
          const { data: retryCustomer } = await supabase
            .from('customers')
            .select('id')
            .eq('email', normalizedEmail)
            .single();
          
          if (retryCustomer) {
            customerId = retryCustomer.id;
          }
        } else {
          return new Response(
            JSON.stringify({ error: 'Erro ao criar conta' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        customerId = newCustomer.id;
        isNewCustomer = true;
        console.log('[REGISTER-REFERRED] Created new customer:', customerId);
      }
    }

    if (!customerId) {
      return new Response(
        JSON.stringify({ error: 'Erro ao processar cadastro' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Check if referrer has exceeded their max referrals
    const { data: referrerUsages } = await supabase
      .from('customer_referral_usage')
      .select('id')
      .eq('referral_code_id', referralCodeData.id);

    const referrerUsageCount = referrerUsages?.length || 0;
    const maxUsesPerReferrer = settings.max_uses_per_referrer || 10;

    if (referrerUsageCount >= maxUsesPerReferrer) {
      console.log('[REGISTER-REFERRED] Referrer has reached max referrals');
      return new Response(
        JSON.stringify({ 
          error: 'Este código de indicação atingiu o limite de uso',
          customerId,
          customerName: name,
          customerEmail: normalizedEmail,
          customerPhone: cleanPhone,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Calculate discount for the referred customer
    const referredDiscountPercent = settings.referred_discount_percent || 10;
    const referrerDiscountPercent = settings.referrer_discount_percent || 10;

    console.log('[REGISTER-REFERRED] Discount percentages:', { referredDiscountPercent, referrerDiscountPercent });

    // 7. Return success with discount info - credits will be applied when order is placed
    const referrerName = referralCodeData.customers?.name || 'Um amigo';

    console.log('[REGISTER-REFERRED] Success - customer registered with pending discount');

    return new Response(
      JSON.stringify({
        success: true,
        customerId,
        customerName: name.trim(),
        customerEmail: normalizedEmail,
        customerPhone: cleanPhone,
        isNewCustomer,
        referralValid: true,
        discountPercent: referredDiscountPercent,
        referrerName,
        referralCodeId: referralCodeData.id,
        referrerId: referralCodeData.customer_id,
        message: `Cadastro realizado! Você ganhou ${referredDiscountPercent}% de desconto por indicação de ${referrerName}.`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[REGISTER-REFERRED] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
