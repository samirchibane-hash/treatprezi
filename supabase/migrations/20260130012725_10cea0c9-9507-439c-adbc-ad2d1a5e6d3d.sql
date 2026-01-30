-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create a products/services catalog table for dealerships
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dealership_id UUID NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can view products from their dealership
CREATE POLICY "Users can view products in their dealership" 
ON public.products 
FOR SELECT 
USING (dealership_id = get_user_dealership(auth.uid()));

-- Admins can insert products
CREATE POLICY "Admins can insert products" 
ON public.products 
FOR INSERT 
WITH CHECK (
  dealership_id = get_user_dealership(auth.uid()) 
  AND get_user_role(auth.uid(), dealership_id) = 'admin'::user_role
);

-- Admins can update products
CREATE POLICY "Admins can update products" 
ON public.products 
FOR UPDATE 
USING (
  dealership_id = get_user_dealership(auth.uid()) 
  AND get_user_role(auth.uid(), dealership_id) = 'admin'::user_role
);

-- Admins can delete products
CREATE POLICY "Admins can delete products" 
ON public.products 
FOR DELETE 
USING (
  dealership_id = get_user_dealership(auth.uid()) 
  AND get_user_role(auth.uid(), dealership_id) = 'admin'::user_role
);

-- Create updated_at trigger
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create invoices table to track generated invoices
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  dealership_id UUID NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  stripe_invoice_id TEXT,
  stripe_payment_link TEXT,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  customer_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Users can view invoices in their dealership (admins see all, reps see their own)
CREATE POLICY "Users can view their invoices" 
ON public.invoices 
FOR SELECT 
USING (
  created_by = auth.uid() 
  OR get_user_role(auth.uid(), dealership_id) = 'admin'::user_role
);

-- Users can create invoices in their dealership
CREATE POLICY "Users can create invoices" 
ON public.invoices 
FOR INSERT 
WITH CHECK (
  dealership_id = get_user_dealership(auth.uid()) 
  AND created_by = auth.uid()
);

-- Users can update their own invoices
CREATE POLICY "Users can update their invoices" 
ON public.invoices 
FOR UPDATE 
USING (created_by = auth.uid());

-- Create updated_at trigger for invoices
CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();