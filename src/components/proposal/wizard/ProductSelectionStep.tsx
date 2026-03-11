import { useState, useEffect } from 'react';
import { Loader2, Image, ChevronLeft, ChevronRight, Check, Tag, Gift, Percent, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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

interface Promotion {
  id: string;
  name: string;
  description: string | null;
  code: string;
  discount_type: 'percent' | 'fixed' | 'free';
  discount_value: number;
  product_id: string | null;
  free_product_name?: string | null;
}

interface Props {
  state: WizardState;
  update: (partial: Partial<WizardState>) => void;
}

export function ProductSelectionStep({ state, update }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showFinancing, setShowFinancing] = useState(true);
  const [financingMonths, setFinancingMonths] = useState(180);
  const { profile } = useAuth();

  useEffect(() => {
    Promise.all([fetchProducts(), fetchPromotions()]);
  }, []);

  useEffect(() => {
    if (profile?.dealership_id) fetchPricingSettings();
  }, [profile?.dealership_id]);

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

  const fetchPricingSettings = async () => {
    const { data } = await supabase
      .from('dealerships')
      .select('show_financing_pricing, financing_months')
      .eq('id', profile!.dealership_id!)
      .single();
    if (data) {
      setShowFinancing(data.show_financing_pricing ?? true);
      setFinancingMonths(data.financing_months ?? 180);
    }
  };

  const fetchPromotions = async () => {
    const { data } = await supabase
      .from('promotions')
      .select('id, name, description, code, discount_type, discount_value, product_id')
      .eq('active', true)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

    if (!data) return;

    // For free-product promotions, fetch the product name
    const withNames = await Promise.all(
      data.map(async (promo: any) => {
        if (promo.discount_type === 'free' && promo.product_id) {
          const { data: prod } = await supabase
            .from('products')
            .select('name')
            .eq('id', promo.product_id)
            .single();
          return { ...promo, free_product_name: prod?.name ?? null };
        }
        return promo;
      })
    );

    setPromotions(withNames as Promotion[]);
  };

  const formatPrice = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

  const formatMonthly = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100 / financingMonths);

  const syncProductSelection = async (newIds: string[]) => {
    if (!state.proposalId || !profile?.dealership_id) return;

    // Replace all proposal_products for this proposal
    await supabase
      .from('proposal_products' as any)
      .delete()
      .eq('proposal_id', state.proposalId);

    if (newIds.length > 0) {
      await supabase
        .from('proposal_products' as any)
        .insert(
          newIds.map((productId) => ({
            proposal_id: state.proposalId,
            product_id: productId,
            dealership_id: profile.dealership_id,
          }))
        );
    }
  };

  const handleToggle = async (productId: string) => {
    const ids = state.selectedProductIds.includes(productId)
      ? state.selectedProductIds.filter((id) => id !== productId)
      : [...state.selectedProductIds, productId];
    update({ selectedProductIds: ids });
    await syncProductSelection(ids);
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

  const formatDiscount = (promo: Promotion) => {
    if (promo.discount_type === 'percent') return `${promo.discount_value}% off`;
    if (promo.discount_type === 'fixed') return `$${promo.discount_value} off`;
    if (promo.discount_type === 'free') return promo.free_product_name ? `Free: ${promo.free_product_name}` : 'Free Product';
    return '';
  };

  return (
    <div className="space-y-5">
      {/* Active Promotions */}
      {promotions.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Tag className="w-3.5 h-3.5 text-primary" />
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Today's Promotions</p>
          </div>
          <div className="grid gap-2.5">
            {promotions.map((promo) => (
              <div
                key={promo.id}
                className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-primary/80 p-4 shadow-md"
              >
                {/* Decorative circle */}
                <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
                <div className="absolute -right-2 -bottom-8 w-32 h-32 rounded-full bg-white/5" />

                <div className="relative flex items-center gap-4">
                  {/* Icon */}
                  <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                    {promo.discount_type === 'free' ? (
                      <Gift className="w-5 h-5 text-white" />
                    ) : promo.discount_type === 'percent' ? (
                      <Percent className="w-5 h-5 text-white" />
                    ) : (
                      <DollarSign className="w-5 h-5 text-white" />
                    )}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-base leading-tight">{promo.name}</p>
                    <p className="text-white/80 font-semibold text-sm">{formatDiscount(promo)}</p>
                    {promo.description && (
                      <p className="text-white/60 text-xs mt-0.5 line-clamp-1">{promo.description}</p>
                    )}
                  </div>

                  {/* Code badge */}
                  <div className="flex-shrink-0 text-right">
                    <p className="text-white/60 text-[10px] uppercase tracking-wider mb-1">Code</p>
                    <code className="bg-white/20 text-white font-mono font-bold text-sm px-3 py-1.5 rounded-lg backdrop-blur-sm tracking-wider">
                      {promo.code}
                    </code>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                {showFinancing ? (
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl font-bold text-primary leading-none">
                      {formatMonthly(product.price_cents)}<span className="text-sm font-medium text-primary/70">/mo</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatPrice(product.price_cents)} retail
                    </div>
                  </div>
                ) : (
                  <span className="text-2xl font-bold text-primary whitespace-nowrap flex-shrink-0">
                    {formatPrice(product.price_cents)}
                  </span>
                )}
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
          {showFinancing ? (
            <div className="text-right">
              <div className="text-xl font-bold text-primary leading-none">
                {formatMonthly(totalAmount)}<span className="text-sm font-medium text-primary/70">/mo</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{formatPrice(totalAmount)} retail</div>
            </div>
          ) : (
            <span className="text-xl font-bold text-primary">{formatPrice(totalAmount)}</span>
          )}
        </div>
      )}
    </div>
  );
}
