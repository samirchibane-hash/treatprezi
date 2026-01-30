import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { stripe } from '../_shared/stripe.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is an admin
    const { data: role, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('dealership_id, role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !role || role.role !== 'admin') {
      throw new Error('Only admins can check Stripe status');
    }

    const dealershipId = role.dealership_id;

    // Get stripe account from DB
    const { data: stripeAccount } = await supabaseClient
      .from('stripe_accounts')
      .select('*')
      .eq('dealership_id', dealershipId)
      .single();

    if (!stripeAccount) {
      return new Response(JSON.stringify({ connected: false, onboarded: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Retrieve the Stripe account to check if onboarding is complete
    const account = await stripe.accounts.retrieve(stripeAccount.stripe_account_id);
    const isOnboarded = account.charges_enabled && account.payouts_enabled;

    // Update DB if newly onboarded
    if (isOnboarded && !stripeAccount.is_onboarded) {
      await supabaseClient
        .from('stripe_accounts')
        .update({ is_onboarded: true, updated_at: new Date().toISOString() })
        .eq('id', stripeAccount.id);
    }

    return new Response(JSON.stringify({ 
      connected: true, 
      onboarded: isOnboarded,
      accountId: stripeAccount.stripe_account_id,
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
