import { useState, useEffect } from 'react';
import { Receipt, Copy, ExternalLink, Check, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
}

interface Proposal {
  id: string;
  customer_name: string;
  address: string;
  recommended_system: string;
}

interface CreateInvoiceDialogProps {
  proposal: Proposal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateInvoiceDialog({ proposal, open, onOpenChange }: CreateInvoiceDialogProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [customerEmail, setCustomerEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchProducts();
      setPaymentLink(null);
      setSelectedProductIds([]);
      setCustomerEmail('');
    }
  }, [open]);

  const fetchProducts = async () => {
    setLoadingProducts(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (!error && data) {
      setProducts(data);
    }
    setLoadingProducts(false);
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const totalAmount = products
    .filter((p) => selectedProductIds.includes(p.id))
    .reduce((sum, p) => sum + p.price_cents, 0);

  const handleProductToggle = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const handleCreateInvoice = async () => {
    if (!proposal || selectedProductIds.length === 0 || !customerEmail.trim()) {
      toast({
        title: 'Missing information',
        description: 'Please select at least one product and enter customer email.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-invoice', {
        body: {
          proposalId: proposal.id,
          productIds: selectedProductIds,
          customerEmail: customerEmail.trim(),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setPaymentLink(data.paymentLink);
      toast({
        title: 'Invoice created!',
        description: 'Payment link is ready to share.',
      });
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create invoice',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (paymentLink) {
      await navigator.clipboard.writeText(paymentLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Copied!',
        description: 'Payment link copied to clipboard.',
      });
    }
  };

  if (!proposal) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            Create Invoice
          </DialogTitle>
          <DialogDescription>
            Generate a payment link for {proposal.customer_name}
          </DialogDescription>
        </DialogHeader>

        {paymentLink ? (
          <div className="space-y-4 py-4">
            <div className="bg-accent/50 rounded-lg p-4 text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Payment Link Ready!</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Share this link with your customer to collect payment.
              </p>
              <div className="flex gap-2">
                <Input
                  value={paymentLink}
                  readOnly
                  className="text-sm"
                />
                <Button variant="outline" size="icon" onClick={handleCopyLink}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
                <Button variant="outline" size="icon" onClick={() => window.open(paymentLink, '_blank')}>
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Customer Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="customer@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Select Products/Services</Label>
              {loadingProducts ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No products configured.</p>
                  <p className="text-sm">Ask your admin to add products in Settings.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto rounded-lg border p-2">
                  {products.map((product) => (
                    <label
                      key={product.id}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={selectedProductIds.includes(product.id)}
                        onCheckedChange={() => handleProductToggle(product.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-medium">{product.name}</span>
                          <span className="font-semibold text-primary whitespace-nowrap">
                            {formatPrice(product.price_cents)}
                          </span>
                        </div>
                        {product.description && (
                          <p className="text-sm text-muted-foreground mt-1">{product.description}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {selectedProductIds.length > 0 && (
              <div className="flex justify-between items-center py-3 border-t">
                <span className="font-medium">Total</span>
                <span className="text-xl font-bold text-primary">{formatPrice(totalAmount)}</span>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                variant="water"
                onClick={handleCreateInvoice}
                disabled={loading || selectedProductIds.length === 0 || !customerEmail.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Receipt className="w-4 h-4" />
                    Generate Payment Link
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
