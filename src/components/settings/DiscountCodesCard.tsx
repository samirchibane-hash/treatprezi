import { useState, useEffect } from 'react';
import { Tag, Plus, Trash2, Loader2, ToggleLeft, ToggleRight, Percent, DollarSign } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { useToast } from '@/hooks/use-toast';

interface PromotionCode {
  id: string;
  code: string;
  active: boolean;
  times_redeemed: number;
  max_redemptions: number | null;
  expires_at: number | null;
}

interface Coupon {
  id: string;
  name: string;
  percent_off: number | null;
  amount_off: number | null;
  currency: string | null;
  valid: boolean;
  times_redeemed: number;
  max_redemptions: number | null;
  redeem_by: number | null;
  promotion_codes: PromotionCode[];
}

export function DiscountCodesCard() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const { toast } = useToast();

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-coupons', {
        body: { action: 'list' },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setCoupons(data.coupons || []);
    } catch (error) {
      console.error('Error fetching coupons:', error);
      // Don't show error toast if Stripe not connected
      if (error instanceof Error && !error.message.includes('Stripe account not connected')) {
        toast({
          title: 'Error',
          description: 'Failed to load discount codes',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || !code.trim() || !discountValue) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in name, code, and discount value',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-coupons', {
        body: {
          action: 'create',
          name: name.trim(),
          code: code.trim(),
          discountType,
          discountValue,
          maxRedemptions: maxRedemptions || undefined,
          expiresAt: expiresAt || undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Discount created!',
        description: `Code "${code.toUpperCase()}" is now active`,
      });

      // Reset form
      setName('');
      setCode('');
      setDiscountType('percent');
      setDiscountValue('');
      setMaxRedemptions('');
      setExpiresAt('');
      setDialogOpen(false);
      fetchCoupons();
    } catch (error) {
      console.error('Error creating coupon:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create discount code',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (couponId: string) => {
    setDeleting(couponId);
    try {
      const { data, error } = await supabase.functions.invoke('manage-coupons', {
        body: { action: 'delete', couponId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Deleted',
        description: 'Discount code has been removed',
      });
      fetchCoupons();
    } catch (error) {
      console.error('Error deleting coupon:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete discount code',
        variant: 'destructive',
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleToggle = async (promoCodeId: string, currentActive: boolean) => {
    setToggling(promoCodeId);
    try {
      const { data, error } = await supabase.functions.invoke('manage-coupons', {
        body: { action: 'toggle', promoCodeId, active: !currentActive },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: currentActive ? 'Deactivated' : 'Activated',
        description: `Discount code is now ${currentActive ? 'inactive' : 'active'}`,
      });
      fetchCoupons();
    } catch (error) {
      console.error('Error toggling coupon:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update discount code',
        variant: 'destructive',
      });
    } finally {
      setToggling(null);
    }
  };

  const formatDiscount = (coupon: Coupon) => {
    if (coupon.percent_off) {
      return `${coupon.percent_off}% off`;
    }
    if (coupon.amount_off) {
      return `$${(coupon.amount_off / 100).toFixed(2)} off`;
    }
    return 'Unknown';
  };

  const formatExpiry = (timestamp: number | null) => {
    if (!timestamp) return null;
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  return (
    <Card className="border-0 shadow-soft">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary" />
              Discount Codes
            </CardTitle>
            <CardDescription>
              Create promo codes that customers can apply at checkout
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Add Code
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Discount Code</DialogTitle>
                <DialogDescription>
                  Create a promo code that customers can use at checkout
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Discount Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Summer Sale"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Promo Code</Label>
                  <Input
                    id="code"
                    placeholder="e.g., SUMMER20"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="uppercase"
                  />
                  <p className="text-xs text-muted-foreground">
                    Customers will enter this code at checkout
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Discount Type</Label>
                    <Select value={discountType} onValueChange={(v) => setDiscountType(v as 'percent' | 'fixed')}>
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
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="value">
                      {discountType === 'percent' ? 'Percent Off' : 'Amount Off ($)'}
                    </Label>
                    <Input
                      id="value"
                      type="number"
                      min="0"
                      max={discountType === 'percent' ? 100 : undefined}
                      step={discountType === 'percent' ? 1 : 0.01}
                      placeholder={discountType === 'percent' ? '20' : '50.00'}
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="maxUses">Max Uses (optional)</Label>
                    <Input
                      id="maxUses"
                      type="number"
                      min="1"
                      placeholder="Unlimited"
                      value={maxRedemptions}
                      onChange={(e) => setMaxRedemptions(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expires">Expires (optional)</Label>
                    <Input
                      id="expires"
                      type="date"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="water" onClick={handleCreate} disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      Creating...
                    </>
                  ) : (
                    'Create Code'
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
        ) : coupons.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Tag className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>No discount codes yet</p>
            <p className="text-sm">Create your first code to offer discounts to customers</p>
          </div>
        ) : (
          <div className="space-y-3">
            {coupons.map((coupon) => (
              <div
                key={coupon.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{coupon.name}</span>
                    <Badge variant="secondary">{formatDiscount(coupon)}</Badge>
                    {!coupon.valid && (
                      <Badge variant="outline" className="text-muted-foreground">
                        Expired
                      </Badge>
                    )}
                  </div>
                  {coupon.promotion_codes.map((promo) => (
                    <div key={promo.id} className="flex items-center gap-2 text-sm">
                      <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">
                        {promo.code}
                      </code>
                      <span className="text-muted-foreground">
                        {promo.times_redeemed} used
                        {promo.max_redemptions && ` / ${promo.max_redemptions} max`}
                      </span>
                      {formatExpiry(promo.expires_at) && (
                        <span className="text-muted-foreground">
                          • Expires {formatExpiry(promo.expires_at)}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={() => handleToggle(promo.id, promo.active)}
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
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(coupon.id)}
                  disabled={deleting === coupon.id}
                >
                  {deleting === coupon.id ? (
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
