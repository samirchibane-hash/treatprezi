import { useState, useEffect } from 'react';
import { FileText, Download, Loader2, Trash2, Check, Link, ExternalLink, ScrollText, Tag, X, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

interface Contract {
  id: string;
  file_path: string;
  file_name: string;
  status: string;
  signed_at: string | null;
  signing_token: string | null;
  signing_expires_at: string | null;
  signer_name: string | null;
  created_at: string;
  created_by: string;
  template_id: string | null;
}

interface Template {
  id: string;
  name: string;
  is_default: boolean;
}

interface Product {
  id: string;
  name: string;
  price_cents: number;
}

interface Promotion {
  id: string;
  name: string;
  code: string;
  discount_type: 'percent' | 'fixed' | 'free';
  discount_value: number;
  product_id: string | null;
  expires_at: string | null;
}

interface ContractsTabProps {
  proposalId: string;
  customerName: string;
  selectedProductIds?: string[];
}

const formatPrice = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);

export function ContractsTab({ proposalId, customerName, selectedProductIds: preSelectedIds }: ContractsTabProps) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('default');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(preSelectedIds || []);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [selectedPromoId, setSelectedPromoId] = useState<string | null>(null);

  const { toast } = useToast();
  const { user, profile } = useAuth();

  useEffect(() => {
    fetchContracts();
    fetchTemplates();
    fetchProducts();
  }, [proposalId]);

  useEffect(() => {
    fetchPromotions();
  }, [profile?.dealership_id]);

  const fetchContracts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('created_at', { ascending: false });
    if (!error && data) setContracts(data);
    setLoading(false);
  };

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from('contract_templates')
      .select('id, name, is_default')
      .order('is_default', { ascending: false })
      .order('name');
    if (data) {
      setTemplates(data);
      const defaultTpl = data.find(t => t.is_default);
      if (defaultTpl) setSelectedTemplateId(defaultTpl.id);
    }
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, name, price_cents')
      .eq('is_active', true)
      .order('name');
    if (data) setAllProducts(data as Product[]);
  };

  const fetchPromotions = async () => {
    if (!profile?.dealership_id) return;
    const { data } = await supabase
      .from('promotions')
      .select('id, name, code, discount_type, discount_value, product_id, expires_at')
      .eq('dealership_id', profile.dealership_id)
      .eq('active', true);
    if (data) {
      const now = new Date();
      setPromotions((data as Promotion[]).filter(p => !p.expires_at || new Date(p.expires_at) > now));
    }
  };

  const toggleProduct = (id: string) => {
    setSelectedProductIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const selectPromo = (promoId: string | null) => {
    const promo = promotions.find(p => p.id === promoId) ?? null;
    const prev = promotions.find(p => p.id === selectedPromoId) ?? null;

    setSelectedProductIds(ids => {
      let next = [...ids];
      // Remove previously auto-added free product
      if (prev?.discount_type === 'free' && prev.product_id) {
        next = next.filter(id => id !== prev.product_id);
      }
      // Auto-add new free product
      if (promo?.discount_type === 'free' && promo.product_id && !next.includes(promo.product_id)) {
        next = [...next, promo.product_id];
      }
      return next;
    });

    setSelectedPromoId(promoId);
  };

  const selectedPromo = promotions.find(p => p.id === selectedPromoId) ?? null;

  const subtotalCents = allProducts
    .filter(p => selectedProductIds.includes(p.id))
    .reduce((sum, p) => sum + p.price_cents, 0);

  const freeProductCents = selectedPromo?.discount_type === 'free' && selectedPromo.product_id
    ? (allProducts.find(p => p.id === selectedPromo.product_id)?.price_cents ?? 0)
    : 0;

  const discountCents = selectedPromo
    ? selectedPromo.discount_type === 'percent'
      ? Math.round(subtotalCents * selectedPromo.discount_value / 100)
      : selectedPromo.discount_type === 'fixed'
        ? Math.round(selectedPromo.discount_value * 100)
        : freeProductCents
    : 0;

  const totalCents = subtotalCents - discountCents;

  const buildDiscount = () => {
    if (!selectedPromo) return null;
    if (selectedPromo.discount_type === 'percent') return { code: selectedPromo.code, percent_off: selectedPromo.discount_value };
    if (selectedPromo.discount_type === 'fixed') return { code: selectedPromo.code, amount_off: Math.round(selectedPromo.discount_value * 100) };
    if (selectedPromo.discount_type === 'free' && freeProductCents > 0) return { code: selectedPromo.code, amount_off: freeProductCents };
    return null;
  };

  const handleGenerate = async () => {
    if (selectedProductIds.length === 0) {
      toast({ title: 'No products selected', description: 'Select at least one product below.', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    try {
      const body: Record<string, unknown> = {
        proposalId,
        productIds: selectedProductIds,
        discount: buildDiscount(),
      };
      if (selectedTemplateId !== 'default') body.templateId = selectedTemplateId;

      const { data, error } = await supabase.functions.invoke('generate-contract', { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'Agreement generated!', description: `Agreement for ${customerName} is ready.` });
      if (data?.signingToken) {
        window.open(`${window.location.origin}/sign?token=${data.signingToken}`, '_blank');
      }
      fetchContracts();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to generate agreement', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (contract: Contract) => {
    setDownloading(contract.id);
    try {
      const { data, error } = await supabase.storage.from('contracts').createSignedUrl(contract.file_path, 3600);
      if (error) throw error;
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    } catch {
      toast({ title: 'Error', description: 'Failed to download contract', variant: 'destructive' });
    } finally {
      setDownloading(null);
    }
  };

  const handleCopySigningLink = async (contract: Contract) => {
    if (!contract.signing_token) {
      toast({ title: 'No signing link', description: 'This contract does not have a signing link.', variant: 'destructive' });
      return;
    }
    const signingUrl = `${window.location.origin}/sign?token=${contract.signing_token}`;
    await navigator.clipboard.writeText(signingUrl);
    setCopiedLink(contract.id);
    setTimeout(() => setCopiedLink(null), 2000);
    toast({ title: 'Copied!', description: 'Signing link copied to clipboard.' });
  };

  const handleDelete = async (contract: Contract) => {
    try {
      await supabase.storage.from('contracts').remove([contract.file_path]);
      await supabase.from('contracts').delete().eq('id', contract.id);
      toast({ title: 'Contract deleted' });
      fetchContracts();
    } catch {
      toast({ title: 'Failed to delete contract', variant: 'destructive' });
    }
  };

  const statusConfig = (status: string) => {
    switch (status) {
      case 'signed': return { variant: 'default' as const, label: 'Signed' };
      case 'sent': return { variant: 'secondary' as const, label: 'Sent' };
      case 'expired': return { variant: 'outline' as const, label: 'Expired' };
      default: return { variant: 'outline' as const, label: 'Draft' };
    }
  };

  const isSigned = contracts.some(c => c.status === 'signed');
  const signedProducts = allProducts.filter(p => selectedProductIds.includes(p.id));

  return (
    <div className="space-y-5">

      {/* Signed lock banner */}
      {isSigned && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">
          <Lock className="w-3.5 h-3.5 flex-shrink-0" />
          <p className="text-[12px] font-medium">This agreement is signed and locked. Delete it to start a new one.</p>
        </div>
      )}

      {/* System Buildout */}
      <div className="space-y-2">
        <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">System Buildout</p>

        {isSigned ? (
          /* Read-only: only show selected products */
          <div className="space-y-1">
            {signedProducts.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No products recorded.</p>
            ) : signedProducts.map(product => (
              <div
                key={product.id}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border bg-primary/5 border-primary/30"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded border bg-primary border-primary flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                  <span className="text-[13px] font-medium">{product.name}</span>
                </div>
                <span className="text-[13px] tabular-nums">{formatPrice(product.price_cents)}</span>
              </div>
            ))}
          </div>
        ) : (
          /* Editable */
          allProducts.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No products in catalog.</p>
          ) : (
            <div className="space-y-1">
              {allProducts.map(product => {
                const selected = selectedProductIds.includes(product.id);
                return (
                  <button
                    key={product.id}
                    onClick={() => toggleProduct(product.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-colors ${
                      selected
                        ? 'bg-primary/5 border-primary/30 text-foreground'
                        : 'bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                        selected ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                      }`}>
                        {selected && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      <span className="text-[13px] font-medium">{product.name}</span>
                    </div>
                    <span className="text-[13px] tabular-nums">{formatPrice(product.price_cents)}</span>
                  </button>
                );
              })}
            </div>
          )
        )}

        {/* Subtotal / Total */}
        {selectedProductIds.length > 0 && (
          <div className="pt-1 space-y-1 px-1">
            <div className="flex justify-between text-[13px] text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatPrice(subtotalCents)}</span>
            </div>
            {discountCents > 0 && (
              <div className="flex justify-between text-[13px] text-emerald-600">
                <span>{selectedPromo!.name} ({selectedPromo!.code})</span>
                <span className="tabular-nums">−{formatPrice(discountCents)}</span>
              </div>
            )}
            <div className="flex justify-between text-[13px] font-semibold border-t pt-1">
              <span>Total</span>
              <span className="tabular-nums">{formatPrice(totalCents)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Promotions */}
      {(isSigned ? selectedPromo !== null : promotions.length > 0) && (
        <div className="space-y-2">
          <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">
            {isSigned ? 'Promotion Applied' : 'Apply Promotion'}
          </p>
          <div className="flex flex-wrap gap-2">
            {isSigned ? (
              /* Read-only: just the applied promo as a static badge */
              selectedPromo && (() => {
                const freeProduct = selectedPromo.discount_type === 'free' && selectedPromo.product_id
                  ? allProducts.find(p => p.id === selectedPromo.product_id)
                  : null;
                const label = selectedPromo.discount_type === 'percent'
                  ? `${selectedPromo.discount_value}% off`
                  : selectedPromo.discount_type === 'fixed'
                    ? `$${selectedPromo.discount_value} off`
                    : freeProduct ? `Free ${freeProduct.name}` : 'Free Product';
                return (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] font-medium bg-emerald-50 border-emerald-300 text-emerald-700">
                    <Tag className="w-3 h-3" />
                    <span>{selectedPromo.name}</span>
                    <span className="opacity-70">· {label}</span>
                  </span>
                );
              })()
            ) : (
              /* Editable */
              promotions.map(promo => {
                const active = selectedPromoId === promo.id;
                const freeProduct = promo.discount_type === 'free' && promo.product_id
                  ? allProducts.find(p => p.id === promo.product_id)
                  : null;
                const label = promo.discount_type === 'percent'
                  ? `${promo.discount_value}% off`
                  : promo.discount_type === 'fixed'
                    ? `$${promo.discount_value} off`
                    : freeProduct
                      ? `Free ${freeProduct.name}`
                      : 'Free Product';
                return (
                  <button
                    key={promo.id}
                    onClick={() => selectPromo(active ? null : promo.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] font-medium transition-colors ${
                      active
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : 'bg-muted/40 border-transparent text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Tag className="w-3 h-3" />
                    <span>{promo.name}</span>
                    <span className="opacity-70">· {label}</span>
                    {active && <X className="w-3 h-3 ml-0.5" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Template + Generate — hidden when signed */}
      {!isSigned && (
        <div className="space-y-3">
          {templates.length > 1 && (
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger className="h-9 text-[13px]">
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default Template</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} {t.is_default ? '(default)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="water"
            className="w-full"
            onClick={handleGenerate}
            disabled={generating || selectedProductIds.length === 0 || contracts.length > 0}
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating Agreement...</>
            ) : (
              <><ScrollText className="w-4 h-4" /> Confirm & Generate Agreement</>
            )}
          </Button>
          {contracts.length > 0 ? (
            <p className="text-[12px] text-muted-foreground text-center">Delete the existing agreement below to generate a new one.</p>
          ) : selectedProductIds.length === 0 && (
            <p className="text-[12px] text-muted-foreground text-center">Select at least one product above.</p>
          )}
        </div>
      )}

      {/* Contracts list */}
      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading agreements...</p>
      ) : contracts.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">No agreements generated yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {contracts.map((contract) => {
            const sc = statusConfig(contract.status);
            return (
              <div key={contract.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{contract.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(contract.created_at), 'MMM d, yyyy h:mm a')}
                      {contract.signer_name && ` • Signed by ${contract.signer_name}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Badge variant={sc.variant}>{sc.label}</Badge>
                  {contract.signing_token && contract.status !== 'signed' && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => window.open(`${window.location.origin}/sign?token=${contract.signing_token}`, '_blank')} title="Open signing page">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleCopySigningLink(contract)} title="Copy signing link">
                        {copiedLink === contract.id ? <Check className="w-4 h-4" /> : <Link className="w-4 h-4" />}
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => handleDownload(contract)} disabled={downloading === contract.id} title="Download">
                    {downloading === contract.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  </Button>
                  {contract.created_by === user?.id && (
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(contract)} title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
