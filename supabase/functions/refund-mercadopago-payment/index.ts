import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RefundRequest {
  payment_id: string;
  order_id?: string;
  amount?: number; // Partial refund amount (optional - full refund if not provided)
  reason?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { payment_id, order_id, amount, reason }: RefundRequest = await req.json();

    console.log("[refund-mercadopago-payment] Request:", { payment_id, order_id, amount, reason });

    if (!payment_id) {
      return new Response(
        JSON.stringify({ error: "payment_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get order to find company
    let companyId: string | null = null;

    if (order_id) {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("company_id, total, mercadopago_payment_id")
        .eq("id", order_id)
        .single();

      if (orderError || !order) {
        console.error("[refund-mercadopago-payment] Order not found:", orderError);
        return new Response(
          JSON.stringify({ error: "Pedido não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      companyId = order.company_id;
    } else {
      // Try to find order by payment ID
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("id, company_id, total")
        .eq("mercadopago_payment_id", payment_id)
        .single();

      if (!orderError && order) {
        companyId = order.company_id;
      }
    }

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: "Empresa não encontrada para este pagamento" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get company payment settings
    const { data: paymentSettings, error: settingsError } = await supabase
      .from("company_payment_settings")
      .select("mercadopago_access_token")
      .eq("company_id", companyId)
      .single();

    if (settingsError || !paymentSettings?.mercadopago_access_token) {
      console.error("[refund-mercadopago-payment] No access token:", settingsError);
      return new Response(
        JSON.stringify({ error: "Configuração de pagamento não encontrada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = paymentSettings.mercadopago_access_token;

    // First, get the payment details from Mercado Pago
    const paymentResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${payment_id}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      }
    );

    if (!paymentResponse.ok) {
      const errorData = await paymentResponse.json();
      console.error("[refund-mercadopago-payment] Error fetching payment:", errorData);
      return new Response(
        JSON.stringify({ error: "Pagamento não encontrado no Mercado Pago" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const paymentData = await paymentResponse.json();
    console.log("[refund-mercadopago-payment] Payment data:", {
      status: paymentData.status,
      transaction_amount: paymentData.transaction_amount,
      refunds: paymentData.refunds,
    });

    // Check if payment can be refunded
    if (paymentData.status !== "approved") {
      return new Response(
        JSON.stringify({ 
          error: `Pagamento não pode ser estornado. Status atual: ${paymentData.status}` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine refund amount
    const refundAmount = amount || paymentData.transaction_amount;

    if (refundAmount > paymentData.transaction_amount) {
      return new Response(
        JSON.stringify({ error: "Valor do estorno não pode ser maior que o valor do pagamento" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process the refund
    const refundBody: any = {};
    
    // For partial refunds, include the amount
    if (amount && amount < paymentData.transaction_amount) {
      refundBody.amount = amount;
    }

    console.log("[refund-mercadopago-payment] Processing refund:", { 
      payment_id, 
      refundAmount,
      isPartial: amount && amount < paymentData.transaction_amount 
    });

    const refundResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${payment_id}/refunds`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": `refund-${payment_id}-${Date.now()}`,
        },
        body: JSON.stringify(refundBody),
      }
    );

    const refundData = await refundResponse.json();
    console.log("[refund-mercadopago-payment] Refund response:", refundData);

    if (!refundResponse.ok) {
      // Handle specific error cases
      if (refundData.message?.includes("already refunded")) {
        return new Response(
          JSON.stringify({ error: "Este pagamento já foi estornado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          error: refundData.message || "Erro ao processar estorno no Mercado Pago",
          details: refundData 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update order with refund information
    if (order_id) {
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          payment_status: refundAmount >= paymentData.transaction_amount ? "refunded" : "partially_refunded",
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order_id);

      if (updateError) {
        console.error("[refund-mercadopago-payment] Error updating order:", updateError);
      }
    }

    // Log the refund
    await supabase.from("activity_logs").insert({
      company_id: companyId,
      action: "payment_refunded",
      details: {
        payment_id,
        order_id,
        refund_id: refundData.id,
        refund_amount: refundAmount,
        reason: reason || "Estorno solicitado pelo administrador",
      },
    });

    console.log("[refund-mercadopago-payment] Refund successful:", {
      refund_id: refundData.id,
      amount: refundAmount,
    });

    return new Response(
      JSON.stringify({
        success: true,
        refund_id: refundData.id,
        amount: refundAmount,
        status: refundData.status,
        message: `Estorno de R$ ${refundAmount.toFixed(2)} realizado com sucesso`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[refund-mercadopago-payment] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno ao processar estorno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
