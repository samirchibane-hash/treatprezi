
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
