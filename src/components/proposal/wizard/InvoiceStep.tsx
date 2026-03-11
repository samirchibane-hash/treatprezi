import { useState, useEffect } from 'react';
import { Receipt, Copy, ExternalLink, Check, Loader2, Tag, Landmark, CreditCard, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import type { WizardState } from '@/hooks/useProposalWizard';

interface FinancingPartner {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  application_url: string | null;
  installment_months: number[];
}

interface Props {
  state: WizardState;
  update: (partial: Partial<WizardState>) => void;
}

export function InvoiceStep({ state, update }: Props) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [partners, setPartners] = useState<FinancingPartner[]>([]);
  const { toast } = useToast();
  const { profile } = useAuth();

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchPartners = async () => {
    const { data } = await supabase
      .from('financing_partners')
      .select('id, name, description, logo_url, application_url, installment_months')
      .eq('is_active', true)
      .order('name');
    if (data) setPartners(data as FinancingPartner[]);
  };

  const handleCreate = async () => {
    if (!state.proposalId || state.selectedProductIds.length === 0 || !state.customerEmailForInvoice.trim()) {
      toast({ title: 'Missing info', description: 'Select products and enter customer email.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-invoice', {
        body: {
          proposalId: state.proposalId,
          productIds: state.selectedProductIds,
          customerEmail: state.customerEmailForInvoice.trim(),
          allowPromoCodes: state.allowPromoCodes,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      update({ paymentLink: data.paymentLink });
      toast({ title: 'Invoice created!', description: 'Payment link is ready.' });
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to create invoice', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (state.paymentLink) {
      await navigator.clipboard.writeText(state.paymentLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Copied!' });
    }
  };

  if (state.paymentLink) {
    return (
      <div className="space-y-4 py-4">
        <div className="bg-accent/10 rounded-lg p-6 text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <Check className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-semibold mb-2">Payment Link Ready!</h3>
          <p className="text-sm text-muted-foreground mb-4">Share this link with your customer.</p>
          <div className="flex gap-2">
            <Input value={state.paymentLink} readOnly className="text-sm" />
            <Button variant="outline" size="icon" onClick={handleCopy}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Button variant="outline" size="icon" onClick={() => window.open(state.paymentLink!, '_blank')}>
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Financing Partners ───────────────────────────────────────── */}
      {partners.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Landmark className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Financing Options</h3>
          </div>

          <div className="space-y-3">
            {partners.map((partner) => (
              <div
                key={partner.id}
                className="rounded-2xl border border-border bg-card overflow-hidden"
              >
                {/* Partner header */}
                <div className="flex items-center gap-4 p-4 border-b border-border/50">
                  {/* Logo */}
                  <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden border">
                    {partner.logo_url ? (
                      <img src={partner.logo_url} alt={partner.name} className="w-full h-full object-contain p-1.5" />
                    ) : (
                      <Landmark className="w-6 h-6 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{partner.name}</p>
                    {partner.description && (
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{partner.description}</p>
                    )}
                  </div>
                </div>

                {/* Financing terms + CTA */}
                <div className="px-4 py-3 flex items-center justify-between gap-4 bg-muted/30">
                  <div className="flex-1 min-w-0">
                    {partner.installment_months && partner.installment_months.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {partner.installment_months.map((m) => (
                          <span key={m} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
                            {m} mo
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Terms vary</p>
                    )}
                  </div>

                  <Button
                    variant="water"
                    size="sm"
                    disabled={!partner.application_url}
                    onClick={() => partner.application_url && window.open(partner.application_url, '_blank')}
                    className="flex-shrink-0 gap-1.5"
                  >
                    Apply Now
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Divider ─────────────────────────────────────────────────── */}
      {partners.length > 0 && (
        <div className="relative flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Or pay with Stripe</span>
          <div className="flex-1 h-px bg-border" />
        </div>
      )}

      {/* ── Stripe Payment ───────────────────────────────────────────── */}
      <div className="space-y-4">
        {partners.length === 0 && (
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Stripe Payment</h3>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="invoiceEmail">Customer Email</Label>
          <Input
            id="invoiceEmail"
            type="email"
            placeholder="customer@example.com"
            value={state.customerEmailForInvoice}
            onChange={(e) => update({ customerEmailForInvoice: e.target.value })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-muted-foreground" />
            <Label htmlFor="promo-toggle" className="text-sm cursor-pointer">Allow discount codes</Label>
          </div>
          <Switch id="promo-toggle" checked={state.allowPromoCodes} onCheckedChange={(v) => update({ allowPromoCodes: v })} />
        </div>

        <Button
          variant="water"
          className="w-full"
          onClick={handleCreate}
          disabled={loading || state.selectedProductIds.length === 0 || !state.customerEmailForInvoice.trim()}
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
            : <><Receipt className="w-4 h-4" /> Generate Payment Link</>}
        </Button>

        {state.selectedProductIds.length === 0 && (
          <p className="text-sm text-muted-foreground text-center">Go back and select products first.</p>
        )}
      </div>
    </div>
  );
}
