import { useState, useEffect } from 'react';
import { Loader2, Image, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
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
  const [currentIndex, setCurrentIndex] = useState(0);

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

  const goNext = () => setCurrentIndex((i) => Math.min(i + 1, products.length - 1));
  const goPrev = () => setCurrentIndex((i) => Math.max(i - 1, 0));

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

  const product = products[currentIndex];
  const isSelected = state.selectedProductIds.includes(product.id);

  return (
    <div className="space-y-5">
      {/* Product Card — horizontal layout */}
      <div className="flex gap-5 rounded-xl border bg-card overflow-hidden animate-fade-in" key={product.id}>
        {/* Square image */}
        <div className="w-52 min-h-52 flex-shrink-0 bg-muted flex items-center justify-center overflow-hidden">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover aspect-square"
            />
          ) : (
            <Image className="w-10 h-10 text-muted-foreground/30" />
          )}
        </div>

        {/* Details */}
        <div className="flex-1 py-5 pr-5 flex flex-col justify-between min-w-0">
          <div className="space-y-3">
            <div>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold text-foreground leading-tight">{product.name}</h3>
                <span className="text-lg font-bold text-primary whitespace-nowrap">
                  {formatPrice(product.price_cents)}
                </span>
              </div>
              {product.description && (
                <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{product.description}</p>
              )}
            </div>

            {product.highlights && product.highlights.length > 0 && (
              <ul className="space-y-1.5">
                {product.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{h}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Button
            variant={isSelected ? 'default' : 'outline'}
            size="sm"
            className="mt-4 w-fit"
            onClick={() => handleToggle(product.id)}
          >
            {isSelected ? <><Check className="w-4 h-4" /> Added</> : 'Add to System'}
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={goPrev} disabled={currentIndex === 0}>
          <ChevronLeft className="w-4 h-4" /> Previous
        </Button>

        <div className="flex items-center gap-1.5">
          {products.map((p, i) => {
            const selected = state.selectedProductIds.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => setCurrentIndex(i)}
                className={cn(
                  'w-2 h-2 rounded-full transition-all duration-200',
                  i === currentIndex
                    ? 'bg-primary scale-125'
                    : selected
                      ? 'bg-primary/40'
                      : 'bg-muted-foreground/20'
                )}
                title={p.name}
              />
            );
          })}
        </div>

        <Button variant="ghost" size="sm" onClick={goNext} disabled={currentIndex === products.length - 1}>
          Next <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Summary */}
      {state.selectedProductIds.length > 0 && (
        <div className="flex justify-between items-center border-t pt-3">
          <span className="text-sm text-muted-foreground">
            {state.selectedProductIds.length} product{state.selectedProductIds.length > 1 ? 's' : ''} selected
          </span>
          <span className="text-xl font-bold text-primary">{formatPrice(totalAmount)}</span>
        </div>
      )}
    </div>
  );
}
