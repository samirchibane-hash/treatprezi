
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
