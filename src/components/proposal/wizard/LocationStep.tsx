import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { WizardState } from '@/hooks/useProposalWizard';

interface Props {
  state: WizardState;
  update: (partial: Partial<WizardState>) => void;
}

export function LocationStep({ state, update }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="street" className="font-medium">Street Address</Label>
        <Input id="street" placeholder="e.g., 123 Main St" value={state.street} onChange={(e) => update({ street: e.target.value })} className="h-12 text-lg" autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city" className="font-medium">City</Label>
          <Input id="city" placeholder="e.g., Austin" value={state.city} onChange={(e) => update({ city: e.target.value })} className="h-12 text-lg" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state" className="font-medium">State</Label>
          <Input id="state" placeholder="e.g., TX" value={state.state} onChange={(e) => update({ state: e.target.value })} className="h-12 text-lg" />
        </div>
      </div>
      <div className="w-1/2">
        <div className="space-y-2">
          <Label htmlFor="zipCode" className="font-medium">ZIP Code</Label>
          <Input id="zipCode" placeholder="e.g., 78701" value={state.zipCode} onChange={(e) => update({ zipCode: e.target.value })} className="h-12 text-lg" />
        </div>
      </div>
    </div>
  );
}
