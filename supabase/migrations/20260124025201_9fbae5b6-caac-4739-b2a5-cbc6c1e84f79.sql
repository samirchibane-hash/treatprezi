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
