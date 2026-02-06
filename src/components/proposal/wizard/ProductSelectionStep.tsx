import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import type { WizardState } from '@/hooks/useProposalWizard';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
}

interface Props {
  state: WizardState;
  update: (partial: Partial<WizardState>) => void;
}

export function ProductSelectionStep({ state, update }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (data) setProducts(data);
    setLoading(false);
  };

  const formatPrice = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

  const handleToggle = (productId: string) => {
    const ids = state.selectedProductIds.includes(productId)
      ? state.selectedProductIds.filter((id) => id !== productId)
      : [...state.selectedProductIds, productId];
    update({ selectedProductIds: ids });
  };

  const totalAmount = products
    .filter((p) => state.selectedProductIds.includes(p.id))
    .reduce((sum, p) => sum + p.price_cents, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No products configured.</p>
        <p className="text-sm mt-1">Ask your admin to add products in Settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 max-h-80 overflow-y-auto rounded-lg border p-2">
        {products.map((product) => (
          <label
            key={product.id}
            className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors"
          >
            <Checkbox
              checked={state.selectedProductIds.includes(product.id)}
              onCheckedChange={() => handleToggle(product.id)}
            />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start gap-2">
                <span className="font-medium">{product.name}</span>
                <span className="font-semibold text-primary whitespace-nowrap">{formatPrice(product.price_cents)}</span>
              </div>
              {product.description && (
                <p className="text-sm text-muted-foreground mt-1">{product.description}</p>
              )}
            </div>
          </label>
        ))}
      </div>

      {state.selectedProductIds.length > 0 && (
        <div className="flex justify-between items-center border-t pt-3">
          <span className="font-medium">Total</span>
          <span className="text-xl font-bold text-primary">{formatPrice(totalAmount)}</span>
        </div>
      )}
    </div>
  );
}
