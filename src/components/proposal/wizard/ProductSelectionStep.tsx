import { useState, useEffect } from 'react';
import { Loader2, Image } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import type { WizardState } from '@/hooks/useProposalWizard';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  highlights: string[];
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
    if (data) setProducts(data as unknown as Product[]);
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
      <div className="space-y-3 max-h-[500px] overflow-y-auto rounded-lg border p-3">
        {products.map((product) => {
          const isSelected = state.selectedProductIds.includes(product.id);
          return (
            <label
              key={product.id}
              className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors border ${
                isSelected ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-accent'
              }`}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => handleToggle(product.id)}
                className="mt-1"
              />
              {/* Product Image */}
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <Image className="w-5 h-5 text-muted-foreground/40" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                  <span className="font-medium">{product.name}</span>
                  <span className="font-semibold text-primary whitespace-nowrap">{formatPrice(product.price_cents)}</span>
                </div>
                {product.description && (
                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{product.description}</p>
                )}
                {product.highlights && product.highlights.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {product.highlights.map((h, i) => (
                      <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {h}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </label>
          );
        })}
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
