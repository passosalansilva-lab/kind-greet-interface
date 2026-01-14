import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function logStep(step: string, details?: Record<string, unknown>) {
  const detailsStr = details ? ` | ${JSON.stringify(details)}` : "";
  console.log(`[driver-token-login] ${step}${detailsStr}`);
}

function generateSecurePassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
  let password = "";
  const randomValues = new Uint8Array(24);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < 24; i++) {
    password += chars[randomValues[i] % chars.length];
  }
  return password;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      logStep("Missing token");
      return new Response(
        JSON.stringify({ error: "Token não informado" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    logStep("Looking up driver by token");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Find driver by access_token
    const { data: driver, error: driverError } = await supabaseAdmin
      .from("delivery_drivers")
      .select("id, email, driver_name, is_active, user_id, company_id, auth_password")
      .eq("access_token", token)
      .eq("is_active", true)
      .maybeSingle();

    if (driverError) {
      logStep("Error querying driver", { error: driverError.message });
      return new Response(
        JSON.stringify({ error: "Erro ao buscar entregador" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!driver) {
      logStep("Driver not found or inactive for token");
      return new Response(
        JSON.stringify({ error: "Link de acesso inválido ou expirado" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    logStep("Driver found", { driverId: driver.id, hasUserId: !!driver.user_id });

    // Check if driver has email
    if (!driver.email) {
      return new Response(
        JSON.stringify({ error: "Entregador sem email cadastrado" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    let userId = driver.user_id;
    let authPassword = driver.auth_password;

    // Create or update auth user if needed
    if (!userId || !authPassword) {
      logStep("Creating/updating auth user for driver");

      authPassword = generateSecurePassword();

      // Check if user exists in auth
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(
        (u) => u.email?.toLowerCase() === driver.email!.toLowerCase()
      );

      if (existingUser) {
        userId = existingUser.id;
        // Update password
        await supabaseAdmin.auth.admin.updateUserById(userId, { password: authPassword });
        logStep("Updated existing auth user password");
      } else {
        // Create new user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: driver.email,
          password: authPassword,
          email_confirm: true,
        });

        if (createError) {
          logStep("Error creating auth user", { error: createError.message });
          return new Response(
            JSON.stringify({ error: "Erro ao criar acesso" }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        userId = newUser.user.id;
        logStep("Created new auth user", { userId });
      }

      // Update driver record
      await supabaseAdmin
        .from("delivery_drivers")
        .update({ user_id: userId, auth_password: authPassword })
        .eq("id", driver.id);
    }

    // Sign in the driver
    logStep("Signing in driver");
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: driver.email,
      password: authPassword!,
    });

    if (signInError) {
      logStep("Sign in failed, resetting password", { error: signInError.message });

      // Reset password and retry
      const newPassword = generateSecurePassword();
      await supabaseAdmin.auth.admin.updateUserById(userId!, { password: newPassword });
      await supabaseAdmin
        .from("delivery_drivers")
        .update({ auth_password: newPassword })
        .eq("id", driver.id);

      const { data: retryData, error: retryError } = await supabaseAdmin.auth.signInWithPassword({
        email: driver.email,
        password: newPassword,
      });

      if (retryError) {
        logStep("Retry sign in failed", { error: retryError.message });
        return new Response(
          JSON.stringify({ error: "Não foi possível autenticar" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      logStep("Login successful after password reset");
      return new Response(
        JSON.stringify({
          session: retryData.session,
          driverName: driver.driver_name,
          companyId: driver.company_id,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    logStep("Login successful");
    return new Response(
      JSON.stringify({
        session: signInData.session,
        driverName: driver.driver_name,
        companyId: driver.company_id,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    logStep("Unexpected error", { error: String(error) });
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
