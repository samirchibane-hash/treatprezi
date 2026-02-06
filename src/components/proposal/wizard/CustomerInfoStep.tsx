import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { WizardState } from '@/hooks/useProposalWizard';

interface Props {
  state: WizardState;
  update: (partial: Partial<WizardState>) => void;
}

export function CustomerInfoStep({ state, update }: Props) {
  const isValidEmail = (email: string) => {
    if (!email.trim()) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="customerName" className="font-medium">Customer Name</Label>
        <Input
          id="customerName"
          placeholder="e.g., John Smith"
          value={state.customerName}
          onChange={(e) => update({ customerName: e.target.value })}
          className="h-12 text-lg"
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="customerEmail" className="font-medium">
          Email <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="customerEmail"
          type="email"
          placeholder="e.g., john@example.com"
          value={state.customerEmail}
          onChange={(e) => update({ customerEmail: e.target.value })}
          className={`h-12 text-lg ${!isValidEmail(state.customerEmail) ? 'border-destructive' : ''}`}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="customerPhone" className="font-medium">
          Phone <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="customerPhone"
          type="tel"
          placeholder="e.g., (555) 123-4567"
          value={state.customerPhone}
          onChange={(e) => update({ customerPhone: e.target.value })}
          className="h-12 text-lg"
        />
      </div>
    </div>
  );
}
