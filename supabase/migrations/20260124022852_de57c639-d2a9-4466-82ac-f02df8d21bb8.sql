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