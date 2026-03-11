-- Create role enum
CREATE TYPE public.user_role AS ENUM ('admin', 'rep');

-- Create dealerships table
CREATE TABLE public.dealerships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE DEFAULT substring(md5(random()::text), 1, 8),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  dealership_id UUID REFERENCES public.dealerships(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  dealership_id UUID REFERENCES public.dealerships(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL DEFAULT 'rep',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, dealership_id)
);

-- Create proposals table
CREATE TABLE public.proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  address TEXT NOT NULL,
  recommended_system TEXT NOT NULL,
  presentation_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  dealership_id UUID REFERENCES public.dealerships(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.dealerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid, _dealership_id uuid)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id AND dealership_id = _dealership_id
  LIMIT 1
$$;

-- Security definer function to get user's dealership
CREATE OR REPLACE FUNCTION public.get_user_dealership(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dealership_id FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- RLS Policies for dealerships
CREATE POLICY "Users can view their own dealership"
  ON public.dealerships FOR SELECT
  USING (id = public.get_user_dealership(auth.uid()));

CREATE POLICY "Anyone can create a dealership"
  ON public.dealerships FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update their dealership"
  ON public.dealerships FOR UPDATE
  USING (public.get_user_role(auth.uid(), id) = 'admin');

-- RLS Policies for profiles
CREATE POLICY "Users can view profiles in their dealership"
  ON public.profiles FOR SELECT
  USING (dealership_id = public.get_user_dealership(auth.uid()) OR dealership_id IS NULL);

CREATE POLICY "Users can create their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view roles in their dealership"
  ON public.user_roles FOR SELECT
  USING (dealership_id = public.get_user_dealership(auth.uid()));

CREATE POLICY "Users can create their own role during signup"
  ON public.user_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for proposals
CREATE POLICY "Reps can view their own proposals"
  ON public.proposals FOR SELECT
  USING (
    created_by = auth.uid() OR 
    public.get_user_role(auth.uid(), dealership_id) = 'admin'
  );

CREATE POLICY "Users can create proposals in their dealership"
  ON public.proposals FOR INSERT
  WITH CHECK (
    dealership_id = public.get_user_dealership(auth.uid()) AND
    created_by = auth.uid()
  );

CREATE POLICY "Users can update their own proposals"
  ON public.proposals FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own proposals"
  ON public.proposals FOR DELETE
  USING (created_by = auth.uid());
-- Fix the overly permissive policy by restricting dealership creation to authenticated users
DROP POLICY "Anyone can create a dealership" ON public.dealerships;

CREATE POLICY "Authenticated users can create a dealership"
  ON public.dealerships FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
-- Create function to find dealership by invite code (bypasses RLS)
CREATE OR REPLACE FUNCTION public.find_dealership_by_invite_code(code text)
RETURNS TABLE(id uuid, name text, invite_code text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.name, d.invite_code
  FROM public.dealerships d
  WHERE LOWER(d.invite_code) = LOWER(code)
$$;
-- Fix RLS so authenticated users can create a dealership
-- The existing policy was created as RESTRICTIVE (shown as Permissive: No), which blocks inserts unless a PERMISSIVE policy also allows them.

-- Remove old policy name(s) (one appears to have a trailing space)
DROP POLICY IF EXISTS "Authenticated users can create a dealership" ON public.dealerships;
DROP POLICY IF EXISTS "Authenticated users can create a dealership " ON public.dealerships;

-- Create a PERMISSIVE insert policy for authenticated users
CREATE POLICY "Authenticated users can create a dealership"
ON public.dealerships
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND created_by = auth.uid()
);

-- Create a secure backend function to create a dealership and attach it to the current user.
-- This avoids brittle multi-step client inserts that can fail under RLS.

CREATE OR REPLACE FUNCTION public.create_dealership_for_current_user(_name text)
RETURNS public.dealerships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_dealership public.dealerships;
  v_email text;
  v_full_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _name IS NULL OR btrim(_name) = '' THEN
    RAISE EXCEPTION 'Dealership name is required';
  END IF;

  -- Best-effort name from JWT
  v_email := nullif(auth.jwt() ->> 'email', '');
  v_full_name := coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
    nullif(split_part(v_email, '@', 1), ''),
    'User'
  );

  -- Ensure profile exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid()) THEN
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (auth.uid(), v_full_name);
  END IF;

  -- Create dealership
  INSERT INTO public.dealerships (name, created_by)
  VALUES (_name, auth.uid())
  RETURNING * INTO v_dealership;

  -- Attach user to dealership
  UPDATE public.profiles
  SET dealership_id = v_dealership.id
  WHERE user_id = auth.uid();

  -- Create admin role if missing
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.dealership_id = v_dealership.id
  ) THEN
    INSERT INTO public.user_roles (user_id, dealership_id, role)
    VALUES (auth.uid(), v_dealership.id, 'admin');
  END IF;

  RETURN v_dealership;
END;
$$;

-- Lock down function execution
REVOKE ALL ON FUNCTION public.create_dealership_for_current_user(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_dealership_for_current_user(text) TO authenticated;

-- Add phone and email to profiles table
ALTER TABLE public.profiles
ADD COLUMN phone text,
ADD COLUMN email text;

-- Add address and phone to dealerships table
ALTER TABLE public.dealerships
ADD COLUMN address text,
ADD COLUMN phone text;
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
-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create a products/services catalog table for dealerships
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dealership_id UUID NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can view products from their dealership
CREATE POLICY "Users can view products in their dealership" 
ON public.products 
FOR SELECT 
USING (dealership_id = get_user_dealership(auth.uid()));

-- Admins can insert products
CREATE POLICY "Admins can insert products" 
ON public.products 
FOR INSERT 
WITH CHECK (
  dealership_id = get_user_dealership(auth.uid()) 
  AND get_user_role(auth.uid(), dealership_id) = 'admin'::user_role
);

-- Admins can update products
CREATE POLICY "Admins can update products" 
ON public.products 
FOR UPDATE 
USING (
  dealership_id = get_user_dealership(auth.uid()) 
  AND get_user_role(auth.uid(), dealership_id) = 'admin'::user_role
);

-- Admins can delete products
CREATE POLICY "Admins can delete products" 
ON public.products 
FOR DELETE 
USING (
  dealership_id = get_user_dealership(auth.uid()) 
  AND get_user_role(auth.uid(), dealership_id) = 'admin'::user_role
);

-- Create updated_at trigger
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create invoices table to track generated invoices
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  dealership_id UUID NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  stripe_invoice_id TEXT,
  stripe_payment_link TEXT,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  customer_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Users can view invoices in their dealership (admins see all, reps see their own)
CREATE POLICY "Users can view their invoices" 
ON public.invoices 
FOR SELECT 
USING (
  created_by = auth.uid() 
  OR get_user_role(auth.uid(), dealership_id) = 'admin'::user_role
);

-- Users can create invoices in their dealership
CREATE POLICY "Users can create invoices" 
ON public.invoices 
FOR INSERT 
WITH CHECK (
  dealership_id = get_user_dealership(auth.uid()) 
  AND created_by = auth.uid()
);

-- Users can update their own invoices
CREATE POLICY "Users can update their invoices" 
ON public.invoices 
FOR UPDATE 
USING (created_by = auth.uid());

-- Create updated_at trigger for invoices
CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- Add customer contact and water test fields to proposals table
ALTER TABLE public.proposals 
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  -- Household details
  ADD COLUMN IF NOT EXISTS home_age text,
  ADD COLUMN IF NOT EXISTS household_size text,
  ADD COLUMN IF NOT EXISTS num_showers text,
  ADD COLUMN IF NOT EXISTS num_bathrooms text,
  ADD COLUMN IF NOT EXISTS bottled_water_cases text,
  ADD COLUMN IF NOT EXISTS water_source text,
  ADD COLUMN IF NOT EXISTS has_dishwasher boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_dryer boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_water_heater boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_ice_maker boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS water_concerns text,
  -- Water test fields
  ADD COLUMN IF NOT EXISTS hardness numeric,
  ADD COLUMN IF NOT EXISTS iron numeric,
  ADD COLUMN IF NOT EXISTS tds numeric,
  ADD COLUMN IF NOT EXISTS ph numeric,
  ADD COLUMN IF NOT EXISTS chlorine numeric;

-- Create storage bucket for installation photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('installation-photos', 'installation-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Create table for installation photos
CREATE TABLE IF NOT EXISTS public.installation_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  dealership_id uuid NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  uploaded_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on installation_photos
ALTER TABLE public.installation_photos ENABLE ROW LEVEL SECURITY;

-- RLS policies for installation_photos
CREATE POLICY "Users can view photos in their dealership"
  ON public.installation_photos FOR SELECT
  USING (dealership_id = get_user_dealership(auth.uid()));

CREATE POLICY "Users can upload photos to their proposals"
  ON public.installation_photos FOR INSERT
  WITH CHECK (
    dealership_id = get_user_dealership(auth.uid()) AND
    uploaded_by = auth.uid()
  );

CREATE POLICY "Users can delete their own photos"
  ON public.installation_photos FOR DELETE
  USING (uploaded_by = auth.uid());

-- Storage policies for installation-photos bucket
CREATE POLICY "Users can view photos in their dealership"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'installation-photos' AND (storage.foldername(name))[1] = get_user_dealership(auth.uid())::text);

CREATE POLICY "Users can upload photos to their dealership folder"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'installation-photos' AND (storage.foldername(name))[1] = get_user_dealership(auth.uid())::text);

CREATE POLICY "Users can delete photos from their dealership folder"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'installation-photos' AND (storage.foldername(name))[1] = get_user_dealership(auth.uid())::text);

-- Create contracts table
CREATE TABLE public.contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  dealership_id UUID NOT NULL REFERENCES public.dealerships(id),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'expired')),
  signed_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- RLS policies scoped to dealership
CREATE POLICY "Users can view contracts in their dealership"
  ON public.contracts FOR SELECT
  USING (dealership_id IN (
    SELECT dealership_id FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create contracts in their dealership"
  ON public.contracts FOR INSERT
  WITH CHECK (dealership_id IN (
    SELECT dealership_id FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update contracts in their dealership"
  ON public.contracts FOR UPDATE
  USING (dealership_id IN (
    SELECT dealership_id FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own contracts"
  ON public.contracts FOR DELETE
  USING (created_by = auth.uid());

-- Timestamp trigger
CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for contracts
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can view contracts in their dealership"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'contracts' AND (storage.foldername(name))[1] IN (
    SELECT dealership_id::text FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can upload contracts in their dealership"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'contracts' AND (storage.foldername(name))[1] IN (
    SELECT dealership_id::text FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete contracts they created"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'contracts' AND (storage.foldername(name))[1] IN (
    SELECT dealership_id::text FROM public.profiles WHERE user_id = auth.uid()
  ));


-- Create contract_templates table for admin-managed templates
CREATE TABLE public.contract_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dealership_id UUID NOT NULL REFERENCES public.dealerships(id),
  name TEXT NOT NULL,
  description TEXT,
  html_content TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

-- Only admins can manage templates
CREATE POLICY "Users can view templates in their dealership"
  ON public.contract_templates FOR SELECT
  USING (dealership_id = get_user_dealership(auth.uid()));

CREATE POLICY "Admins can create templates"
  ON public.contract_templates FOR INSERT
  WITH CHECK (
    dealership_id = get_user_dealership(auth.uid())
    AND get_user_role(auth.uid(), dealership_id) = 'admin'::user_role
  );

CREATE POLICY "Admins can update templates"
  ON public.contract_templates FOR UPDATE
  USING (
    dealership_id = get_user_dealership(auth.uid())
    AND get_user_role(auth.uid(), dealership_id) = 'admin'::user_role
  );

CREATE POLICY "Admins can delete templates"
  ON public.contract_templates FOR DELETE
  USING (
    dealership_id = get_user_dealership(auth.uid())
    AND get_user_role(auth.uid(), dealership_id) = 'admin'::user_role
  );

-- Timestamp trigger
CREATE TRIGGER update_contract_templates_updated_at
  BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add template_id to contracts table
ALTER TABLE public.contracts
  ADD COLUMN template_id UUID REFERENCES public.contract_templates(id);

-- Add signing columns to contracts
ALTER TABLE public.contracts
  ADD COLUMN signing_token TEXT,
  ADD COLUMN signing_expires_at TIMESTAMPTZ,
  ADD COLUMN signer_name TEXT,
  ADD COLUMN signer_ip TEXT;

ALTER TABLE public.proposals ADD COLUMN install_date date DEFAULT NULL;

-- Add image_url and highlights columns to products
ALTER TABLE public.products ADD COLUMN image_url text DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN highlights text[] DEFAULT '{}';

-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

-- Storage policies for product images
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update product images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete product images"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);


-- Create announcements table for admin/system updates
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dealership_id UUID REFERENCES public.dealerships(id) ON DELETE CASCADE,
  posted_by UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Admins can create announcements for their dealership
CREATE POLICY "Admins can create announcements"
  ON public.announcements
  FOR INSERT
  WITH CHECK (
    (dealership_id = get_user_dealership(auth.uid()) AND get_user_role(auth.uid(), dealership_id) = 'admin'::user_role)
    OR is_system = false
  );

-- Everyone in the dealership can view announcements (or system-wide ones)
CREATE POLICY "Users can view announcements in their dealership"
  ON public.announcements
  FOR SELECT
  USING (
    dealership_id = get_user_dealership(auth.uid())
    OR is_system = true
  );

-- Admins can update their own announcements
CREATE POLICY "Admins can update their announcements"
  ON public.announcements
  FOR UPDATE
  USING (
    posted_by = auth.uid()
    AND get_user_role(auth.uid(), dealership_id) = 'admin'::user_role
  );

-- Admins can delete their own announcements
CREATE POLICY "Admins can delete their announcements"
  ON public.announcements
  FOR DELETE
  USING (
    posted_by = auth.uid()
    AND get_user_role(auth.uid(), dealership_id) = 'admin'::user_role
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_announcements_updated_at();


CREATE TABLE public.proposal_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  dealership_id UUID NOT NULL REFERENCES public.dealerships(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(proposal_id, product_id)
);

ALTER TABLE public.proposal_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view proposal products in their dealership"
ON public.proposal_products FOR SELECT
USING (dealership_id = get_user_dealership(auth.uid()));

CREATE POLICY "Users can insert proposal products"
ON public.proposal_products FOR INSERT
WITH CHECK (dealership_id = get_user_dealership(auth.uid()));

CREATE POLICY "Users can delete proposal products"
ON public.proposal_products FOR DELETE
USING (dealership_id = get_user_dealership(auth.uid()));

ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'draft';

-- Promotions table (Stripe-independent promo codes)
CREATE TABLE IF NOT EXISTS public.promotions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dealership_id UUID NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC NOT NULL,
  max_redemptions INTEGER,
  times_redeemed INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view promotions for their dealership"
ON public.promotions FOR SELECT
USING (dealership_id = get_user_dealership(auth.uid()));

CREATE POLICY "Admins can insert promotions"
ON public.promotions FOR INSERT
WITH CHECK (dealership_id = get_user_dealership(auth.uid()));

CREATE POLICY "Admins can update promotions"
ON public.promotions FOR UPDATE
USING (dealership_id = get_user_dealership(auth.uid()));

CREATE POLICY "Admins can delete promotions"
ON public.promotions FOR DELETE
USING (dealership_id = get_user_dealership(auth.uid()));

-- Allow 'free' as a discount type for promotions
ALTER TABLE public.promotions
  DROP CONSTRAINT IF EXISTS promotions_discount_type_check;

ALTER TABLE public.promotions
  ADD CONSTRAINT promotions_discount_type_check
  CHECK (discount_type IN ('percent', 'fixed', 'free'));

-- Add product_id to promotions for Free Product type
ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

-- Add description to promotions
ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Financing Partners table
CREATE TABLE IF NOT EXISTS public.financing_partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dealership_id UUID NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  installment_months INTEGER[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.financing_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view financing partners for their dealership"
ON public.financing_partners FOR SELECT
USING (dealership_id = get_user_dealership(auth.uid()));

CREATE POLICY "Admins can insert financing partners"
ON public.financing_partners FOR INSERT
WITH CHECK (dealership_id = get_user_dealership(auth.uid()));

CREATE POLICY "Admins can update financing partners"
ON public.financing_partners FOR UPDATE
USING (dealership_id = get_user_dealership(auth.uid()));

CREATE POLICY "Admins can delete financing partners"
ON public.financing_partners FOR DELETE
USING (dealership_id = get_user_dealership(auth.uid()));

-- Add application_url to financing_partners
ALTER TABLE public.financing_partners
  ADD COLUMN IF NOT EXISTS application_url TEXT;

-- Add pass/fail water test result columns to proposals
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS water_test_mode TEXT DEFAULT 'exact',
  ADD COLUMN IF NOT EXISTS hardness_result TEXT,
  ADD COLUMN IF NOT EXISTS iron_result TEXT,
  ADD COLUMN IF NOT EXISTS tds_result TEXT,
  ADD COLUMN IF NOT EXISTS ph_result TEXT,
  ADD COLUMN IF NOT EXISTS chlorine_result TEXT,
  ADD COLUMN IF NOT EXISTS soap_test_result TEXT;

-- Pricing display settings on dealerships
ALTER TABLE public.dealerships
  ADD COLUMN IF NOT EXISTS show_financing_pricing BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS financing_months INTEGER NOT NULL DEFAULT 180;
