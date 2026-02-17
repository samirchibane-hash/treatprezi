
CREATE TABLE public.proposal_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  dealership_id UUID NOT NULL REFERENCES public.dealerships(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(proposal_id, product_id)
);

ALTER TABLE public.proposal_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view proposal products in their dealership"
ON public.proposal_products FOR SELECT
USING (dealership_id = get_user_dealership(auth.uid()));

CREATE POLICY "Users can insert proposal products"
ON public.proposal_products FOR INSERT
WITH CHECK (dealership_id = get_user_dealership(auth.uid()));

CREATE POLICY "Users can delete proposal products"
ON public.proposal_products FOR DELETE
USING (dealership_id = get_user_dealership(auth.uid()));
