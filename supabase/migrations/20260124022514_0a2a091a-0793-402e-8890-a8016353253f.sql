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