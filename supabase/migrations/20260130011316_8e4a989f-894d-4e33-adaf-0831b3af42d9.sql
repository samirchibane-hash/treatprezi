-- Create stripe_accounts table for storing connected Stripe account info
CREATE TABLE public.stripe_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  stripe_account_id TEXT NOT NULL UNIQUE,
  is_onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stripe_accounts ENABLE ROW LEVEL SECURITY;

-- Only admins in the same dealership can view their stripe account record
CREATE POLICY "Admins can view their dealership stripe account"
ON public.stripe_accounts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.dealership_id = stripe_accounts.dealership_id
      AND user_roles.role = 'admin'
  )
);

-- Only admins can insert stripe account records for their dealership
CREATE POLICY "Admins can insert their dealership stripe account"
ON public.stripe_accounts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.dealership_id = stripe_accounts.dealership_id
      AND user_roles.role = 'admin'
  )
);

-- Only admins can update their dealership stripe account record
CREATE POLICY "Admins can update their dealership stripe account"
ON public.stripe_accounts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.dealership_id = stripe_accounts.dealership_id
      AND user_roles.role = 'admin'
  )
);