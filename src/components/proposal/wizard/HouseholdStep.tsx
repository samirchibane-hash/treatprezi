import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HOME_AGE_OPTIONS, HOUSEHOLD_SIZE_OPTIONS, WATER_SOURCE_OPTIONS } from '@/hooks/useProposalWizard';
import type { WizardState } from '@/hooks/useProposalWizard';

interface Props {
  state: WizardState;
  update: (partial: Partial<WizardState>) => void;
}

export function HouseholdStep({ state, update }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="font-medium">Home Age</Label>
          <Select value={state.homeAge} onValueChange={(v) => update({ homeAge: v })}>
            <SelectTrigger className="h-12"><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {HOME_AGE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="font-medium">Household Size</Label>
          <Select value={state.householdSize} onValueChange={(v) => update({ householdSize: v })}>
            <SelectTrigger className="h-12"><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {HOUSEHOLD_SIZE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="numShowers" className="font-medium">Number of Showers</Label>
          <Input id="numShowers" type="number" min="0" placeholder="e.g., 2" value={state.numShowers} onChange={(e) => update({ numShowers: e.target.value })} className="h-12" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="numBathrooms" className="font-medium">Number of Bathrooms</Label>
          <Input id="numBathrooms" type="number" min="0" placeholder="e.g., 2" value={state.numBathrooms} onChange={(e) => update({ numBathrooms: e.target.value })} className="h-12" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="font-medium">Water Source</Label>
          <Select value={state.waterSource} onValueChange={(v) => update({ waterSource: v })}>
            <SelectTrigger className="h-12"><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {WATER_SOURCE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bottledWater" className="font-medium">Bottled Water/Month</Label>
          <Input id="bottledWater" type="number" min="0" placeholder="Cases per month" value={state.bottledWaterCases} onChange={(e) => update({ bottledWaterCases: e.target.value })} className="h-12" />
        </div>
      </div>

      <div className="space-y-3">
        <Label className="font-medium">Appliances in Home</Label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'hasDishwasher' as const, label: 'Dishwasher' },
            { key: 'hasDryer' as const, label: 'Dryer' },
            { key: 'hasWaterHeater' as const, label: 'Water Heater' },
            { key: 'hasIceMaker' as const, label: 'Ice Maker' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors">
              <Checkbox checked={state[key]} onCheckedChange={(checked) => update({ [key]: checked === true })} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="waterConcerns" className="font-medium">
          Water Concerns <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input id="waterConcerns" placeholder="e.g., hard water, bad taste, staining..." value={state.waterConcerns} onChange={(e) => update({ waterConcerns: e.target.value })} className="h-12" />
      </div>
    </div>
  );
}
