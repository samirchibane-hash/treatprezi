import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno&deno-std=0.132.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[MANAGE-COUPONS] ${step}${detailsStr}`);
};

// Get Stripe instance
const getStripe = () => {
  const stripeSecretKey = Deno.env.get("STRIPE_TEST_SECRET_KEY") || Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeSecretKey) {
    throw new Error("Stripe secret key not configured");
  }
  return new Stripe(stripeSecretKey, {
    apiVersion: '2025-01-27.acacia',
    httpClient: Stripe.createFetchHttpClient(),
  });
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

    // Get user's dealership and verify admin role
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('dealership_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.dealership_id) {
      throw new Error('User has no dealership');
    }

    const { data: userRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('dealership_id', profile.dealership_id)
      .single();

    if (userRole?.role !== 'admin') {
      throw new Error('Only admins can manage discount codes');
    }

    const dealershipId = profile.dealership_id;
    logStep('Admin verified', { dealershipId });

    // Get the connected Stripe account
    const { data: stripeAccount, error: stripeAccountError } = await supabaseClient
      .from('stripe_accounts')
      .select('stripe_account_id, is_onboarded')
      .eq('dealership_id', dealershipId)
      .single();

    if (stripeAccountError || !stripeAccount || !stripeAccount.is_onboarded) {
      throw new Error('Stripe account not connected or onboarding incomplete');
    }

    const connectedAccountId = stripeAccount.stripe_account_id;
    logStep('Stripe account found', { connectedAccountId });

    const stripe = getStripe();
    const { action, ...params } = await req.json();
    logStep('Request params', { action, params });

    let result: unknown;

    switch (action) {
      case 'list': {
        // List all coupons for the connected account
        const coupons = await stripe.coupons.list(
          { limit: 100 },
          { stripeAccount: connectedAccountId }
        );
        
        // Also get promotion codes for each coupon
        const couponsWithCodes = await Promise.all(
          coupons.data.map(async (coupon: Stripe.Coupon) => {
            const promoCodes = await stripe.promotionCodes.list(
              { coupon: coupon.id, limit: 10 },
              { stripeAccount: connectedAccountId }
            );
            return {
              ...coupon,
              promotion_codes: promoCodes.data,
            };
          })
        );
        
        result = { coupons: couponsWithCodes };
        logStep('Listed coupons', { count: coupons.data.length });
        break;
      }

      case 'create': {
        const { name, code, discountType, discountValue, maxRedemptions, expiresAt } = params;
        
        if (!name || !code || !discountType || !discountValue) {
          throw new Error('Missing required fields: name, code, discountType, discountValue');
        }

        // Create coupon
        const couponParams: Stripe.CouponCreateParams = {
          name,
          ...(discountType === 'percent' 
            ? { percent_off: parseFloat(discountValue) }
            : { amount_off: Math.round(parseFloat(discountValue) * 100), currency: 'usd' }
          ),
          ...(maxRedemptions ? { max_redemptions: parseInt(maxRedemptions) } : {}),
          ...(expiresAt ? { redeem_by: Math.floor(new Date(expiresAt).getTime() / 1000) } : {}),
        };

        const coupon = await stripe.coupons.create(couponParams, {
          stripeAccount: connectedAccountId,
        });
        logStep('Coupon created', { couponId: coupon.id });

        // Create promotion code
        const promoCode = await stripe.promotionCodes.create(
          {
            coupon: coupon.id,
            code: code.toUpperCase(),
            ...(maxRedemptions ? { max_redemptions: parseInt(maxRedemptions) } : {}),
            ...(expiresAt ? { expires_at: Math.floor(new Date(expiresAt).getTime() / 1000) } : {}),
          },
          { stripeAccount: connectedAccountId }
        );
        logStep('Promotion code created', { promoCodeId: promoCode.id, code: promoCode.code });

        result = { coupon, promotionCode: promoCode };
        break;
      }

      case 'delete': {
        const { couponId } = params;
        if (!couponId) {
          throw new Error('Missing couponId');
        }

        await stripe.coupons.del(couponId, {
          stripeAccount: connectedAccountId,
        });
        logStep('Coupon deleted', { couponId });
        result = { success: true };
        break;
      }

      case 'toggle': {
        const { promoCodeId, active } = params;
        if (!promoCodeId || active === undefined) {
          throw new Error('Missing promoCodeId or active status');
        }

        const updatedPromoCode = await stripe.promotionCodes.update(
          promoCodeId,
          { active },
          { stripeAccount: connectedAccountId }
        );
        logStep('Promotion code toggled', { promoCodeId, active });
        result = { promotionCode: updatedPromoCode };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
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
