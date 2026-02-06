import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import type { WizardState } from '@/hooks/useProposalWizard';

interface Props {
  state: WizardState;
  update: (partial: Partial<WizardState>) => void;
}

export function WaterTestStep({ state, update }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="hardness" className="font-medium">Hardness <span className="text-muted-foreground font-normal">(Grains)</span></Label>
          <Input id="hardness" type="number" min="0" step="0.1" placeholder="e.g., 15" value={state.hardness} onChange={(e) => update({ hardness: e.target.value })} className="h-12" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="iron" className="font-medium">Iron <span className="text-muted-foreground font-normal">(ppm)</span></Label>
          <Input id="iron" type="number" min="0" step="0.01" placeholder="e.g., 0.3" value={state.iron} onChange={(e) => update({ iron: e.target.value })} className="h-12" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="tds" className="font-medium">TDS <span className="text-muted-foreground font-normal">(ppm)</span></Label>
          <Input id="tds" type="number" min="0" placeholder="e.g., 350" value={state.tds} onChange={(e) => update({ tds: e.target.value })} className="h-12" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="chlorine" className="font-medium">Chlorine <span className="text-muted-foreground font-normal">(ppm)</span></Label>
          <Input id="chlorine" type="number" min="0" step="0.1" placeholder="e.g., 1.5" value={state.chlorine} onChange={(e) => update({ chlorine: e.target.value })} className="h-12" />
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Label className="font-medium">pH Level</Label>
          <span className="text-lg font-semibold text-primary">{state.ph[0].toFixed(1)}</span>
        </div>
        <Slider value={state.ph} onValueChange={(v) => update({ ph: v })} min={0} max={14} step={0.1} className="w-full" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0 (Acidic)</span>
          <span>7 (Neutral)</span>
          <span>14 (Alkaline)</span>
        </div>
      </div>
    </div>
  );
}
