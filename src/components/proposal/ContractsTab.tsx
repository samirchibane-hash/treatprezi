import { useState, useEffect } from 'react';
import { FileText, Download, Loader2, Plus, Trash2, Copy, Check, Link, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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
  description: string | null;
  price_cents: number;
}

interface PromotionCode {
  id: string;
  code: string;
  coupon: {
    id: string;
    name: string;
    percent_off: number | null;
    amount_off: number | null;
    currency: string | null;
  };
  active: boolean;
}

interface ContractsTabProps {
  proposalId: string;
  customerName: string;
  /** Pre-selected product IDs from the wizard */
  selectedProductIds?: string[];
}

export function ContractsTab({ proposalId, customerName, selectedProductIds: preSelectedIds }: ContractsTabProps) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('default');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Product & discount selection
  const [products, setProducts] = useState<Product[]>([]);
  const [contractProductIds, setContractProductIds] = useState<string[]>(preSelectedIds || []);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [promoCodes, setPromoCodes] = useState<PromotionCode[]>([]);
  const [selectedPromoId, setSelectedPromoId] = useState<string>('none');
  const [loadingPromos, setLoadingPromos] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    fetchContracts();
    fetchTemplates();
    fetchProducts();
    fetchPromoCodes();
  }, [proposalId]);

  useEffect(() => {
    if (preSelectedIds?.length) {
      setContractProductIds(preSelectedIds);
    }
  }, [preSelectedIds]);

  const fetchContracts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setContracts(data);
    }
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
    setLoadingProducts(true);
    const { data } = await supabase
      .from('products')
      .select('id, name, description, price_cents')
      .eq('is_active', true)
      .order('name');
    if (data) setProducts(data);
    setLoadingProducts(false);
  };

  const fetchPromoCodes = async () => {
    setLoadingPromos(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-coupons', {
        body: { action: 'list' },
      });
      if (!error && data?.coupons) {
        const codes: PromotionCode[] = [];
        for (const coupon of data.coupons) {
          for (const pc of coupon.promotion_codes || []) {
            if (pc.active) {
              codes.push({
                id: pc.id,
                code: pc.code,
                coupon: {
                  id: coupon.id,
                  name: coupon.name,
                  percent_off: coupon.percent_off,
                  amount_off: coupon.amount_off,
                  currency: coupon.currency,
                },
                active: pc.active,
              });
            }
          }
        }
        setPromoCodes(codes);
      }
    } catch {
      // Silently fail — user may not be admin or no Stripe connected
    }
    setLoadingPromos(false);
  };

  const formatPrice = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

  const handleProductToggle = (productId: string) => {
    setContractProductIds(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const selectedProducts = products.filter(p => contractProductIds.includes(p.id));
  const subtotal = selectedProducts.reduce((sum, p) => sum + p.price_cents, 0);

  const getDiscountInfo = () => {
    if (selectedPromoId === 'none') return null;
    const promo = promoCodes.find(p => p.id === selectedPromoId);
    if (!promo) return null;
    const { coupon } = promo;
    if (coupon.percent_off) {
      return { label: `${promo.code} (${coupon.percent_off}% off)`, amountOff: Math.round(subtotal * coupon.percent_off / 100) };
    }
    if (coupon.amount_off) {
      return { label: `${promo.code} ($${(coupon.amount_off / 100).toFixed(2)} off)`, amountOff: coupon.amount_off };
    }
    return null;
  };

  const discountInfo = getDiscountInfo();
  const total = subtotal - (discountInfo?.amountOff || 0);

  const handleGenerate = async () => {
    if (contractProductIds.length === 0) {
      toast({ title: 'No products selected', description: 'Select at least one product to include in the contract.', variant: 'destructive' });
      return;
    }

    setGenerating(true);
    try {
      const selectedPromo = selectedPromoId !== 'none' ? promoCodes.find(p => p.id === selectedPromoId) : null;

      const body: Record<string, unknown> = {
        proposalId,
        productIds: contractProductIds,
        discount: selectedPromo ? {
          code: selectedPromo.code,
          name: selectedPromo.coupon.name,
          percent_off: selectedPromo.coupon.percent_off,
          amount_off: selectedPromo.coupon.amount_off,
          currency: selectedPromo.coupon.currency,
        } : null,
      };
      if (selectedTemplateId !== 'default') {
        body.templateId = selectedTemplateId;
      }

      const { data, error } = await supabase.functions.invoke('generate-contract', { body });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'Contract generated!', description: `Contract for ${customerName} is ready.` });
      if (data?.signingToken) {
        window.open(`${window.location.origin}/sign?token=${data.signingToken}`, '_blank');
      }
      fetchContracts();
    } catch (error) {
      console.error('Error generating contract:', error);
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to generate contract', variant: 'destructive' });
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

  return (
    <div className="space-y-4">
      {/* Config toggle */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setShowConfig(!showConfig)} className="text-muted-foreground">
          {showConfig ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
          {showConfig ? 'Hide' : 'Configure'} Products & Discounts
        </Button>
        <div className="flex items-end gap-2">
          {templates.length > 0 && (
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Template" />
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
          <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating || contractProductIds.length === 0}>
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
            ) : (
              <><Plus className="w-4 h-4" /> Generate Contract</>
            )}
          </Button>
        </div>
      </div>

      {/* Product & Discount Selection */}
      {showConfig && (
        <div className="space-y-4 rounded-lg border p-4 bg-muted/30 animate-fade-in">
          {/* Products */}
          <div className="space-y-2">
            <Label className="font-medium">Products to Include</Label>
            {loadingProducts ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : products.length === 0 ? (
              <p className="text-sm text-muted-foreground">No products available.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {products.map((product) => (
                  <label
                    key={product.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={contractProductIds.includes(product.id)}
                      onCheckedChange={() => handleProductToggle(product.id)}
                    />
                    <div className="flex-1 flex justify-between items-center min-w-0">
                      <span className="text-sm font-medium truncate">{product.name}</span>
                      <span className="text-sm font-semibold text-primary whitespace-nowrap ml-2">
                        {formatPrice(product.price_cents)}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Discount Code */}
          <div className="space-y-2">
            <Label className="font-medium">Apply Discount</Label>
            {loadingPromos ? (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : promoCodes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active discount codes available.</p>
            ) : (
              <Select value={selectedPromoId} onValueChange={setSelectedPromoId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="No discount" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No discount</SelectItem>
                  {promoCodes.map((pc) => (
                    <SelectItem key={pc.id} value={pc.id}>
                      {pc.code} — {pc.coupon.percent_off ? `${pc.coupon.percent_off}% off` : `$${((pc.coupon.amount_off || 0) / 100).toFixed(2)} off`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Totals */}
          {contractProductIds.length > 0 && (
            <div className="border-t pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal ({contractProductIds.length} item{contractProductIds.length > 1 ? 's' : ''})</span>
                <span className="font-medium">{formatPrice(subtotal)}</span>
              </div>
              {discountInfo && (
                <div className="flex justify-between text-green-600">
                  <span>Discount ({discountInfo.label})</span>
                  <span>-{formatPrice(discountInfo.amountOff)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base border-t pt-2">
                <span>Total</span>
                <span className="text-primary">{formatPrice(total)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading contracts...</p>
      ) : contracts.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground mb-4">No contracts generated yet</p>
          <Button variant="outline" size="sm" onClick={() => { setShowConfig(true); }} disabled={generating}>
            <FileText className="w-4 h-4 mr-2" />
            Configure & Generate Contract
          </Button>
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
