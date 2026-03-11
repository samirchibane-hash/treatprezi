import { useState, useEffect } from 'react';
import { Sparkles, Plus, Trash2, Loader2, ToggleLeft, ToggleRight, Percent, DollarSign, Gift } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
}

interface Promotion {
  id: string;
  name: string;
  description: string | null;
  code: string;
  discount_type: 'percent' | 'fixed' | 'free';
  discount_value: number;
  max_redemptions: number | null;
  times_redeemed: number;
  expires_at: string | null;
  active: boolean;
  created_at: string;
  product_id: string | null;
}

export function PromotionsCard() {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed' | 'free'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  useEffect(() => {
    if (profile?.dealership_id) {
      fetchPromotions();
      fetchProducts();
    }
  }, [profile?.dealership_id]);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    if (data) setProducts(data as Product[]);
  };

  const fetchPromotions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .eq('dealership_id', profile!.dealership_id!)
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: 'Failed to load promotions', variant: 'destructive' });
    } else {
      setPromotions((data as Promotion[]) || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setCode('');
    setDiscountType('percent');
    setDiscountValue('');
    setSelectedProductId('');
    setMaxRedemptions('');
    setExpiresAt('');
  };

  const handleCreate = async () => {
    if (!name.trim() || !code.trim() || (discountType !== 'free' && !discountValue) || (discountType === 'free' && !selectedProductId)) {
      toast({ title: 'Missing fields', description: discountType === 'free' ? 'Please select a product to give for free' : 'Please fill in name, code, and discount value', variant: 'destructive' });
      return;
    }

    setCreating(true);
    const { error } = await supabase.from('promotions').insert({
      dealership_id: profile!.dealership_id!,
      name: name.trim(),
      description: description.trim() || null,
      code: code.trim().toUpperCase(),
      discount_type: discountType,
      discount_value: discountType === 'free' ? 0 : parseFloat(discountValue),
      product_id: discountType === 'free' ? selectedProductId : null,
      max_redemptions: maxRedemptions ? parseInt(maxRedemptions) : null,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Promotion created!', description: `Code "${code.toUpperCase()}" is now active` });
      resetForm();
      setDialogOpen(false);
      fetchPromotions();
    }
    setCreating(false);
  };

  const handleToggle = async (promo: Promotion) => {
    setToggling(promo.id);
    const { error } = await supabase
      .from('promotions')
      .update({ active: !promo.active })
      .eq('id', promo.id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to update promotion', variant: 'destructive' });
    } else {
      toast({ title: promo.active ? 'Deactivated' : 'Activated', description: `Promotion is now ${promo.active ? 'inactive' : 'active'}` });
      fetchPromotions();
    }
    setToggling(null);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const { error } = await supabase.from('promotions').delete().eq('id', id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to delete promotion', variant: 'destructive' });
    } else {
      toast({ title: 'Deleted', description: 'Promotion has been removed' });
      fetchPromotions();
    }
    setDeleting(null);
  };

  const formatDiscount = (promo: Promotion) => {
    if (promo.discount_type === 'free') return 'Free Product';
    if (promo.discount_type === 'percent') return `${promo.discount_value}% off`;
    return `$${promo.discount_value.toFixed(2)} off`;
  };

  const isExpired = (promo: Promotion) =>
    promo.expires_at ? new Date(promo.expires_at) < new Date() : false;

  return (
    <Card className="border-0 shadow-soft">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Promotions
            </CardTitle>
            <CardDescription>
              Create promo codes applied directly in your proposal workflow — no Stripe required
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Add Promotion
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Promotion</DialogTitle>
                <DialogDescription>
                  Create a promo code that can be applied during the proposal process
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="promo-name">Promotion Name</Label>
                  <Input
                    id="promo-name"
                    placeholder="e.g., Summer Sale"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="promo-description">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Textarea
                    id="promo-description"
                    placeholder="e.g., Limited-time discount for new customers"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="promo-code">Promo Code</Label>
                  <Input
                    id="promo-code"
                    placeholder="e.g., SUMMER20"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="uppercase"
                  />
                  <p className="text-xs text-muted-foreground">
                    Customers will enter this code during the proposal flow
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Discount Type</Label>
                    <Select value={discountType} onValueChange={(v) => { setDiscountType(v as 'percent' | 'fixed' | 'free'); setDiscountValue(''); }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">
                          <span className="flex items-center gap-2">
                            <Percent className="w-4 h-4" />
                            Percentage
                          </span>
                        </SelectItem>
                        <SelectItem value="fixed">
                          <span className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            Fixed Amount
                          </span>
                        </SelectItem>
                        <SelectItem value="free">
                          <span className="flex items-center gap-2">
                            <Gift className="w-4 h-4" />
                            Free Product
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {discountType !== 'free' && (
                    <div className="space-y-2">
                      <Label htmlFor="promo-value">
                        {discountType === 'percent' ? 'Percent Off' : 'Amount Off ($)'}
                      </Label>
                      <Input
                        id="promo-value"
                        type="number"
                        min="0"
                        max={discountType === 'percent' ? 100 : undefined}
                        step={discountType === 'percent' ? 1 : 0.01}
                        placeholder={discountType === 'percent' ? '20' : '50.00'}
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                      />
                    </div>
                  )}
                  {discountType === 'free' && (
                    <div className="space-y-2">
                      <Label>Free Product</Label>
                      <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a product..." />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="promo-max">Max Uses (optional)</Label>
                    <Input
                      id="promo-max"
                      type="number"
                      min="1"
                      placeholder="Unlimited"
                      value={maxRedemptions}
                      onChange={(e) => setMaxRedemptions(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="promo-expires">Expires (optional)</Label>
                    <Input
                      id="promo-expires"
                      type="date"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { resetForm(); setDialogOpen(false); }}>
                  Cancel
                </Button>
                <Button variant="water" onClick={handleCreate} disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      Creating...
                    </>
                  ) : (
                    'Create Promotion'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : promotions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>No promotions yet</p>
            <p className="text-sm">Create your first promotion to offer discounts in proposals</p>
          </div>
        ) : (
          <div className="space-y-3">
            {promotions.map((promo) => (
              <div
                key={promo.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium">{promo.name}</span>
                    {promo.description && (
                      <span className="text-xs text-muted-foreground">{promo.description}</span>
                    )}
                    <Badge variant={promo.discount_type === 'free' ? 'default' : 'secondary'} className={promo.discount_type === 'free' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 hover:bg-green-100' : ''}>
                      {promo.discount_type === 'free' && <Gift className="w-3 h-3 mr-1" />}
                      {formatDiscount(promo)}
                    </Badge>
                    {promo.discount_type === 'free' && promo.product_id && (
                      <span className="text-xs text-muted-foreground">
                        → {products.find(p => p.id === promo.product_id)?.name ?? 'Unknown product'}
                      </span>
                    )}
                    {isExpired(promo) && (
                      <Badge variant="outline" className="text-muted-foreground">Expired</Badge>
                    )}
                    {!promo.active && !isExpired(promo) && (
                      <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">
                      {promo.code}
                    </code>
                    <span className="text-muted-foreground">
                      {promo.times_redeemed} used
                      {promo.max_redemptions && ` / ${promo.max_redemptions} max`}
                    </span>
                    {promo.expires_at && (
                      <span className="text-muted-foreground">
                        • Expires {new Date(promo.expires_at).toLocaleDateString()}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={() => handleToggle(promo)}
                      disabled={toggling === promo.id}
                    >
                      {toggling === promo.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : promo.active ? (
                        <ToggleRight className="w-4 h-4 text-primary" />
                      ) : (
                        <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(promo.id)}
                  disabled={deleting === promo.id}
                >
                  {deleting === promo.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
