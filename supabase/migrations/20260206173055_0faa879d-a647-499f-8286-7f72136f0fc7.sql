
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
