import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate a unique referral code
function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyId, customerId } = await req.json();
    
    if (!companyId || !customerId) {
      return new Response(
        JSON.stringify({ error: 'companyId e customerId são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if referral program is enabled for this company
    const { data: settings, error: settingsError } = await supabase
      .from('customer_referral_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    if (settingsError) {
      console.error('[GET-REFERRAL] Error fetching settings:', settingsError);
      throw settingsError;
    }

    if (!settings || !settings.is_enabled) {
      console.log('[GET-REFERRAL] Referral program not enabled for company:', companyId);
      return new Response(
        JSON.stringify({ 
          settings: { is_enabled: false },
          referralCode: null 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if customer already has a referral code
    let { data: existingCode, error: codeError } = await supabase
      .from('customer_referral_codes')
      .select('code')
      .eq('company_id', companyId)
      .eq('customer_id', customerId)
      .maybeSingle();

    if (codeError) {
      console.error('[GET-REFERRAL] Error fetching existing code:', codeError);
      throw codeError;
    }

    let referralCode = existingCode?.code;

    // If no code exists, create one
    if (!referralCode) {
      // Generate unique code with retries
      let attempts = 0;
      const maxAttempts = 5;
      
      while (attempts < maxAttempts) {
        const newCode = generateReferralCode();
        
        // Check if code already exists for this company
        const { data: existing } = await supabase
          .from('customer_referral_codes')
          .select('id')
          .eq('company_id', companyId)
          .eq('code', newCode)
          .maybeSingle();

        if (!existing) {
          // Code is unique, insert it
          const { data: inserted, error: insertError } = await supabase
            .from('customer_referral_codes')
            .insert({
              company_id: companyId,
              customer_id: customerId,
              code: newCode,
            })
            .select('code')
            .single();

          if (insertError) {
            console.error('[GET-REFERRAL] Error inserting code:', insertError);
            // If duplicate key error, retry
            if (insertError.code === '23505') {
              attempts++;
              continue;
            }
            throw insertError;
          }

          referralCode = inserted.code;
          console.log('[GET-REFERRAL] Created new referral code:', referralCode);
          break;
        }
        
        attempts++;
      }

      if (!referralCode) {
        throw new Error('Failed to generate unique referral code');
      }
    }

    console.log('[GET-REFERRAL] Returning referral data for customer:', customerId);
    
    return new Response(
      JSON.stringify({ 
        settings: {
          is_enabled: settings.is_enabled,
          referrer_discount_percent: settings.referrer_discount_percent,
          referred_discount_percent: settings.referred_discount_percent,
        },
        referralCode 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[GET-REFERRAL] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
