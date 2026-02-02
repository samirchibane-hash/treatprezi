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