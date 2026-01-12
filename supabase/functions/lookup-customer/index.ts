import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory rate limiting (resets on function restart)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 5; // max requests
const RATE_WINDOW = 60 * 1000; // per minute

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }
  
  if (record.count >= RATE_LIMIT) {
    return false;
  }
  
  record.count++;
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP for rate limiting
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';
    
    if (!checkRateLimit(clientIP)) {
      console.log(`[LOOKUP-CUSTOMER] Rate limit exceeded for IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ error: 'Muitas tentativas. Aguarde um minuto e tente novamente.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, phone, companyId } = await req.json();
    
    if (!email && !phone) {
      return new Response(
        JSON.stringify({ error: 'Email ou telefone é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input format
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Formato de email inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (phone && !/^[\d\s\-\+\(\)]+$/.test(phone)) {
      return new Response(
        JSON.stringify({ error: 'Formato de telefone inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let normalizedEmail: string | null = null;
    let cleanPhone: string | null = null;

    // Busca o cliente por email OU telefone (identificadores únicos)
    // Prioridade: email primeiro, depois telefone
    let customer = null;

    if (email) {
      normalizedEmail = email.toLowerCase().trim();
      
      // Busca exata por email
      const { data: customerByEmail, error: emailError } = await supabase
        .from('customers')
        .select('id, name, email, phone, user_id')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (emailError) {
        console.error('[LOOKUP-CUSTOMER] Database error on email lookup:', emailError);
      } else if (customerByEmail) {
        customer = customerByEmail;
        console.log(`[LOOKUP-CUSTOMER] Found customer by email: ${customer.id}`);
      }
    }

    // Se não encontrou por email, tenta por telefone
    if (!customer && phone) {
      cleanPhone = phone.replace(/\D/g, '');
      
      const { data: customerByPhone, error: phoneError } = await supabase
        .from('customers')
        .select('id, name, email, phone, user_id')
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (phoneError) {
        console.error('[LOOKUP-CUSTOMER] Database error on phone lookup:', phoneError);
      } else if (customerByPhone) {
        customer = customerByPhone;
        console.log(`[LOOKUP-CUSTOMER] Found customer by phone: ${customer.id}`);
        
        // Se encontrou por telefone mas o email não bate, pode ser cliente diferente
        // Nesse caso, se o email foi fornecido e é diferente, não retorna
        if (normalizedEmail && customerByPhone.email && customerByPhone.email !== normalizedEmail) {
          console.log('[LOOKUP-CUSTOMER] Phone matches but email differs - treating as different customer');
          customer = null;
        }
      }
    }

    // Caso especial: cliente já fez pedido mas ainda não tem registro em customers
    if (!customer && normalizedEmail) {
      console.log('[LOOKUP-CUSTOMER] No customer found, falling back to orders for email:', normalizedEmail);

      // Se companyId foi fornecido, busca apenas pedidos dessa empresa
      let ordersQuery = supabase
        .from('orders')
        .select('id, customer_name, customer_email, customer_phone, company_id')
        .ilike('customer_email', `${normalizedEmail}%`)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (companyId) {
        ordersQuery = ordersQuery.eq('company_id', companyId);
      }

      const { data: lastOrder, error: orderError } = await ordersQuery.maybeSingle();

      if (orderError) {
        console.error('[LOOKUP-CUSTOMER] Error reading orders for email lookup:', orderError);
      }

      if (lastOrder) {
        console.log('[LOOKUP-CUSTOMER] Found last order for email, creating customer from order:', lastOrder.id);
        
        // Limpa o telefone do pedido
        const orderPhone = (lastOrder.customer_phone || '').replace(/\D/g, '');
        
        // Verifica se já existe cliente com esse telefone
        if (orderPhone) {
          const { data: existingByPhone } = await supabase
            .from('customers')
            .select('id, name, email, phone, user_id')
            .eq('phone', orderPhone)
            .maybeSingle();
          
          if (existingByPhone) {
            // Se existe cliente com o telefone mas sem email, atualiza o email
            if (!existingByPhone.email) {
              await supabase
                .from('customers')
                .update({ email: normalizedEmail })
                .eq('id', existingByPhone.id);
              
              customer = { ...existingByPhone, email: normalizedEmail };
              console.log('[LOOKUP-CUSTOMER] Updated existing customer with email:', customer.id);
            } else if (existingByPhone.email === normalizedEmail) {
              customer = existingByPhone;
            }
            // Se o telefone já existe com outro email, cria novo cliente
          }
        }
        
        // Se ainda não tem customer, cria novo
        if (!customer) {
          const { data: newCustomer, error: insertError } = await supabase
            .from('customers')
            .insert({
              name: lastOrder.customer_name || normalizedEmail,
              email: normalizedEmail,
              phone: orderPhone || '',
            })
            .select('id, name, email, phone, user_id')
            .maybeSingle();

          if (insertError) {
            console.error('[LOOKUP-CUSTOMER] Error creating customer from existing order:', insertError);

            // Se já existir um cliente com o mesmo email ou telefone, busca esse registro
            if (insertError.code === '23505') {
              // Tenta buscar por email primeiro
              const { data: existingCustomer } = await supabase
                .from('customers')
                .select('id, name, email, phone, user_id')
                .eq('email', normalizedEmail)
                .maybeSingle();

              if (existingCustomer) {
                customer = existingCustomer;
                console.log('[LOOKUP-CUSTOMER] Using existing customer after duplicate error:', customer.id);
              }
            }
          } else if (newCustomer) {
            customer = newCustomer;
            console.log('[LOOKUP-CUSTOMER] Created new customer:', customer.id);
          }
        }
      } else {
        console.log('[LOOKUP-CUSTOMER] No order found for email fallback:', normalizedEmail);
      }
    }

    // Se companyId foi fornecido, verifica se o cliente tem pedidos nessa empresa
    if (customer && companyId) {
      const { data: hasOrderInCompany, error: orderCheckError } = await supabase
        .from('orders')
        .select('id')
        .eq('customer_id', customer.id)
        .eq('company_id', companyId)
        .limit(1)
        .maybeSingle();
      
      if (orderCheckError) {
        console.error('[LOOKUP-CUSTOMER] Error checking customer orders in company:', orderCheckError);
      }
      
      // Se não tem pedido na empresa, ainda retorna o cliente mas indica que é novo nessa empresa
      const isNewToCompany = !hasOrderInCompany;
      
      console.log(`[LOOKUP-CUSTOMER] Returning customer: ${customer.id} (email: ${customer.email}, phone: ${customer.phone}, newToCompany: ${isNewToCompany})`);
      
      return new Response(
        JSON.stringify({ 
          found: true, 
          customerId: customer.id,
          firstName: customer.name?.split(' ')[0] || 'Cliente',
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          isNewToCompany,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!customer) {
      console.log('[LOOKUP-CUSTOMER] No customer found for provided identifier');
      return new Response(
        JSON.stringify({ found: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[LOOKUP-CUSTOMER] Returning customer: ${customer.id} (email: ${customer.email}, phone: ${customer.phone})`);
    
    return new Response(
      JSON.stringify({ 
        found: true, 
        customerId: customer.id,
        firstName: customer.name?.split(' ')[0] || 'Cliente',
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[LOOKUP-CUSTOMER] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
