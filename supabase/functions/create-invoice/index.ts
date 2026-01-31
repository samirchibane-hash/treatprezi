import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { stripe } from '../_shared/stripe.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-INVOICE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Get the current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      logStep('User authentication failed', userError);
      throw new Error('Unauthorized');
    }
    logStep('User authenticated', { userId: user.id });

    // Get user's dealership
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('dealership_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.dealership_id) {
      throw new Error('User has no dealership');
    }
    const dealershipId = profile.dealership_id;
    logStep('Dealership found', { dealershipId });

    // Get request body
    const { proposalId, productIds, customerEmail, allowPromoCodes } = await req.json();
    logStep('Request params', { proposalId, productIds, customerEmail, allowPromoCodes });

    if (!proposalId || !productIds?.length || !customerEmail) {
      throw new Error('Missing required fields: proposalId, productIds, customerEmail');
    }

    // Get the proposal
    const { data: proposal, error: proposalError } = await supabaseClient
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .single();

    if (proposalError || !proposal) {
      logStep('Proposal fetch failed', proposalError);
      throw new Error('Proposal not found');
    }
    logStep('Proposal found', { customerName: proposal.customer_name });

    // Get the connected Stripe account for this dealership
    const { data: stripeAccount, error: stripeAccountError } = await supabaseClient
      .from('stripe_accounts')
      .select('stripe_account_id, is_onboarded')
      .eq('dealership_id', dealershipId)
      .single();

    if (stripeAccountError || !stripeAccount) {
      logStep('No Stripe account found', stripeAccountError);
      throw new Error('Stripe account not connected. Admin must connect Stripe first.');
    }

    if (!stripeAccount.is_onboarded) {
      throw new Error('Stripe account onboarding not complete');
    }
    logStep('Stripe account verified', { accountId: stripeAccount.stripe_account_id });

    // Get selected products
    const { data: products, error: productsError } = await supabaseClient
      .from('products')
      .select('*')
      .in('id', productIds)
      .eq('is_active', true);

    if (productsError || !products?.length) {
      logStep('Products fetch failed', productsError);
      throw new Error('No valid products found');
    }
    logStep('Products found', { count: products.length });

    // Calculate total amount
    const totalAmountCents = products.reduce((sum, p) => sum + p.price_cents, 0);
    logStep('Total calculated', { totalAmountCents });

    // Create line items for the payment link
    const lineItems = products.map(product => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: product.name,
          description: product.description || undefined,
        },
        unit_amount: product.price_cents,
      },
      quantity: 1,
    }));

    // Create a payment link using the connected account
    const paymentLink = await stripe.paymentLinks.create({
      line_items: lineItems,
      allow_promotion_codes: allowPromoCodes !== false,
      metadata: {
        proposal_id: proposalId,
        customer_name: proposal.customer_name,
        dealership_id: dealershipId,
      },
    }, {
      stripeAccount: stripeAccount.stripe_account_id,
    });
    logStep('Payment link created', { url: paymentLink.url, allowPromoCodes: allowPromoCodes !== false });

    // Store the invoice record
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from('invoices')
      .insert({
        proposal_id: proposalId,
        dealership_id: dealershipId,
        created_by: user.id,
        stripe_payment_link: paymentLink.url,
        amount_cents: totalAmountCents,
        customer_email: customerEmail,
        status: 'sent',
      })
      .select()
      .single();

    if (invoiceError) {
      logStep('Invoice insert failed', invoiceError);
      throw new Error('Failed to save invoice');
    }
    logStep('Invoice saved', { invoiceId: invoice.id });

    return new Response(JSON.stringify({
      success: true,
      paymentLink: paymentLink.url,
      invoiceId: invoice.id,
      amountCents: totalAmountCents,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logStep('ERROR', { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
