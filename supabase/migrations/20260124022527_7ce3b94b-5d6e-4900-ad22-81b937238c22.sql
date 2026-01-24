-- Fix the overly permissive policy by restricting dealership creation to authenticated users
DROP POLICY "Anyone can create a dealership" ON public.dealerships;

CREATE POLICY "Authenticated users can create a dealership"
  ON public.dealerships FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);