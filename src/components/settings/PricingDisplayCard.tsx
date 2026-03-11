import { useState, useEffect } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const MONTH_OPTIONS = [12, 24, 36, 48, 60, 72, 84, 120, 144, 180];

export function PricingDisplayCard() {
  const [showFinancing, setShowFinancing] = useState(true);
  const [financingMonths, setFinancingMonths] = useState(180);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { profile } = useAuth();

  useEffect(() => {
    if (profile?.dealership_id) fetchSettings();
  }, [profile?.dealership_id]);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('dealerships')
      .select('show_financing_pricing, financing_months')
      .eq('id', profile!.dealership_id!)
      .single();
    if (data) {
      setShowFinancing(data.show_financing_pricing ?? true);
      setFinancingMonths(data.financing_months ?? 180);
    }
    setLoading(false);
  };

  const save = async (patch: { show_financing_pricing?: boolean; financing_months?: number }) => {
    if (!profile?.dealership_id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('dealerships')
        .update(patch as any)
        .eq('id', profile.dealership_id);
      if (error) throw error;
      toast({ title: 'Saved' });
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message ?? 'Failed to save settings', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (checked: boolean) => {
    setShowFinancing(checked);
    save({ show_financing_pricing: checked });
  };

  const handleMonthSelect = (months: number) => {
    setFinancingMonths(months);
    save({ financing_months: months });
  };

  if (loading) return null;

  return (
    <Card className="border-0 shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Pricing Display
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground ml-1" />}
        </CardTitle>
        <CardDescription>
          Control how product pricing is shown to customers during the proposal process
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Toggle */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label className="text-sm font-medium">Show Monthly Financing Price</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              When enabled, the monthly payment is shown as the primary price with retail listed below it
            </p>
          </div>
          <Switch checked={showFinancing} onCheckedChange={handleToggle} />
        </div>

        {/* Month selector — only visible when financing is on */}
        {showFinancing && (
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium">Financing Term</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Number of months used to calculate the displayed monthly payment
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {MONTH_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleMonthSelect(m)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-colors ${
                    financingMonths === m
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
                  }`}
                >
                  {m} mo
                </button>
              ))}
            </div>
            <div className="bg-muted/40 rounded-xl px-4 py-3 text-sm text-muted-foreground">
              Example: a <span className="font-semibold text-foreground">$5,000</span> system shows as{' '}
              <span className="font-bold text-primary">
                ${Math.round(5000 / financingMonths)}/mo
              </span>{' '}
              over {financingMonths} months
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
