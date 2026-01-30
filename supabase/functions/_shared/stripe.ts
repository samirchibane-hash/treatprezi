import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno&deno-std=0.132.0';

// This file should only be imported by other edge functions
// Do not call directly from the browser

// Prefer test key if available, otherwise fall back to live key
const stripeSecretKey = Deno.env.get("STRIPE_TEST_SECRET_KEY") || Deno.env.get("STRIPE_SECRET_KEY");
if (!stripeSecretKey) {
  throw new Error("Neither STRIPE_TEST_SECRET_KEY nor STRIPE_SECRET_KEY is set in environment variables");
}

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-01-27.acacia',
  httpClient: Stripe.createFetchHttpClient(),
});

// Export whether we're using test mode for logging/debugging
export const isTestMode = !!Deno.env.get("STRIPE_TEST_SECRET_KEY");
