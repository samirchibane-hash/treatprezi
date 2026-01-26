-- Add phone and email to profiles table
ALTER TABLE public.profiles
ADD COLUMN phone text,
ADD COLUMN email text;

-- Add address and phone to dealerships table
ALTER TABLE public.dealerships
ADD COLUMN address text,
ADD COLUMN phone text;