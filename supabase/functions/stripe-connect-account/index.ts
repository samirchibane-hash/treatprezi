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

    // Get the current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is an admin & get the dealership
    const { data: role, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('dealership_id, role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !role || role.role !== 'admin') {
      throw new Error('Only admins can connect Stripe accounts');
    }

    const dealershipId = role.dealership_id;

    // Check if a stripe_account record already exists for this dealership
    const { data: existingAccount } = await supabaseClient
      .from('stripe_accounts')
      .select('*')
      .eq('dealership_id', dealershipId)
      .single();

    let stripeAccountId = existingAccount?.stripe_account_id;

    if (!stripeAccountId) {
      // Create a new Stripe Connect Standard account
      const account = await stripe.accounts.create({ type: 'standard' });
      stripeAccountId = account.id;

      // Store in DB
      const { error: insertError } = await supabaseClient
        .from('stripe_accounts')
        .insert({
          dealership_id: dealershipId,
          stripe_account_id: stripeAccountId,
          is_onboarded: false,
        });

      if (insertError) {
        console.error('Failed to insert stripe account:', insertError);
        throw new Error('Failed to save Stripe account');
      }
    }

    // Get return URL from request body
    let returnUrl = '';
    try {
      const body = await req.json();
      returnUrl = body.returnUrl || '';
    } catch {
      // No body provided
    }

    if (!returnUrl) {
      returnUrl = `${req.headers.get('origin') || 'http://localhost:3000'}/settings`;
    }

    // Generate an Account Link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: returnUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return new Response(JSON.stringify({ url: accountLink.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: unknown) {
    console.error('Error in stripe-connect-account:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
