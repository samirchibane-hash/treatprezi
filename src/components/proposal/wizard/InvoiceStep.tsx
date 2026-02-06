import { useState } from 'react';
import { Receipt, Copy, ExternalLink, Check, Loader2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { WizardState } from '@/hooks/useProposalWizard';

interface Props {
  state: WizardState;
  update: (partial: Partial<WizardState>) => void;
}

export function InvoiceStep({ state, update }: Props) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

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
    <div className="space-y-4">
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
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : <><Receipt className="w-4 h-4" /> Generate Payment Link</>}
      </Button>

      {state.selectedProductIds.length === 0 && (
        <p className="text-sm text-muted-foreground text-center">Go back and select products first.</p>
      )}
    </div>
  );
}
