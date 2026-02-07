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
      {/* Slideshow Card */}
      <div className="relative rounded-xl border bg-card overflow-hidden animate-fade-in" key={product.id}>
        {/* Image Section */}
        <div className="relative w-full h-52 bg-muted flex items-center justify-center overflow-hidden">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <Image className="w-10 h-10 text-muted-foreground/30" />
          )}
          {/* Nav arrows overlaying image */}
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/80 backdrop-blur flex items-center justify-center text-foreground disabled:opacity-30 transition-opacity hover:bg-background"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={goNext}
            disabled={currentIndex === products.length - 1}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/80 backdrop-blur flex items-center justify-center text-foreground disabled:opacity-30 transition-opacity hover:bg-background"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-foreground">{product.name}</h3>
              {product.description && (
                <p className="text-sm text-muted-foreground mt-1">{product.description}</p>
              )}
            </div>
            <span className="text-xl font-bold text-primary whitespace-nowrap">
              {formatPrice(product.price_cents)}
            </span>
          </div>

          {/* Highlights */}
          {product.highlights && product.highlights.length > 0 && (
            <ul className="space-y-2">
              {product.highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{h}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Add / Remove Button */}
          <Button
            variant={isSelected ? 'default' : 'outline'}
            className="w-full"
            onClick={() => handleToggle(product.id)}
          >
            {isSelected ? (
              <><Check className="w-4 h-4" /> Added to System</>
            ) : (
              'Add to System'
            )}
          </Button>
        </div>
      </div>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-1.5">
        {products.map((p, i) => {
          const selected = state.selectedProductIds.includes(p.id);
          return (
            <button
              key={p.id}
              onClick={() => setCurrentIndex(i)}
              className={cn(
                'w-2.5 h-2.5 rounded-full transition-all duration-200',
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

      {/* Summary bar */}
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
