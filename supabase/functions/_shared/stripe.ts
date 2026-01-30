import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno&deno-std=0.132.0';

// This file should only be imported by other edge functions
// Do not call directly from the browser

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY is not set in environment variables");
}

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-01-27.acacia',
  httpClient: Stripe.createFetchHttpClient(),
});
