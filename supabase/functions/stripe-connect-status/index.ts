import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { stripe, isTestMode } from '../_shared/stripe.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-CONNECT-STATUS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started', { isTestMode });

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Service role client for database updates (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      logStep('Auth failed', userError);
      throw new Error('Unauthorized');
    }
    logStep('User authenticated', { userId: user.id });

    // Check if user is an admin
    const { data: role, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('dealership_id, role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !role || role.role !== 'admin') {
      logStep('Not admin', { roleError, role });
      throw new Error('Only admins can check Stripe status');
    }

    const dealershipId = role.dealership_id;
    logStep('Admin verified', { dealershipId });

    // Get stripe account from DB
    const { data: stripeAccount } = await supabaseClient
      .from('stripe_accounts')
      .select('*')
      .eq('dealership_id', dealershipId)
      .single();

    if (!stripeAccount) {
      logStep('No Stripe account found');
      return new Response(JSON.stringify({ connected: false, onboarded: false, testMode: isTestMode }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    logStep('Stripe account found', { accountId: stripeAccount.stripe_account_id, isOnboarded: stripeAccount.is_onboarded });

    // Retrieve the Stripe account to check if onboarding is complete
    const account = await stripe.accounts.retrieve(stripeAccount.stripe_account_id);
    const isOnboarded = account.charges_enabled && account.payouts_enabled;
    logStep('Stripe API response', { chargesEnabled: account.charges_enabled, payoutsEnabled: account.payouts_enabled, isOnboarded });

    // Update DB if newly onboarded (using admin client to bypass RLS)
    if (isOnboarded && !stripeAccount.is_onboarded) {
      logStep('Updating is_onboarded to true');
      const { error: updateError } = await supabaseAdmin
        .from('stripe_accounts')
        .update({ is_onboarded: true, updated_at: new Date().toISOString() })
        .eq('id', stripeAccount.id);
      
      if (updateError) {
        logStep('Failed to update is_onboarded', updateError);
      } else {
        logStep('Successfully updated is_onboarded');
      }
    }

    return new Response(JSON.stringify({ 
      connected: true, 
      onboarded: isOnboarded,
      accountId: stripeAccount.stripe_account_id,
      testMode: isTestMode,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: unknown) {
    console.error('Error in stripe-connect-status:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
