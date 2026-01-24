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
