import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import type { WizardState } from '@/hooks/useProposalWizard';

interface Props {
  state: WizardState;
  update: (partial: Partial<WizardState>) => void;
}

type PassFail = 'pass' | 'fail' | '';

function PassFailToggle({
  value,
  onChange,
}: {
  value: PassFail;
  onChange: (v: PassFail) => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange(value === 'pass' ? '' : 'pass')}
        className={`flex-1 h-12 rounded-lg border-2 font-medium text-sm transition-colors ${
          value === 'pass'
            ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400'
            : 'border-border bg-background text-muted-foreground hover:border-green-400 hover:text-green-600'
        }`}
      >
        Pass
      </button>
      <button
        type="button"
        onClick={() => onChange(value === 'fail' ? '' : 'fail')}
        className={`flex-1 h-12 rounded-lg border-2 font-medium text-sm transition-colors ${
          value === 'fail'
            ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400'
            : 'border-border bg-background text-muted-foreground hover:border-red-400 hover:text-red-600'
        }`}
      >
        Fail
      </button>
    </div>
  );
}

export function WaterTestStep({ state, update }: Props) {
  const isPassFail = state.waterTestMode === 'passfail';

  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <Button
          type="button"
          variant={isPassFail ? 'default' : 'ghost'}
          size="sm"
          onClick={() => update({ waterTestMode: 'passfail' })}
          className="text-xs"
        >
          Pass / Fail
        </Button>
        <Button
          type="button"
          variant={!isPassFail ? 'default' : 'ghost'}
          size="sm"
          onClick={() => update({ waterTestMode: 'exact' })}
          className="text-xs"
        >
          Exact Values
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="hardness" className="font-medium">
            Hardness <span className="text-muted-foreground font-normal">(Grains)</span>
          </Label>
          {isPassFail ? (
            <PassFailToggle
              value={state.hardnessResult}
              onChange={(v) => update({ hardnessResult: v })}
            />
          ) : (
            <Input id="hardness" type="number" min="0" step="0.1" placeholder="e.g., 15" value={state.hardness} onChange={(e) => update({ hardness: e.target.value })} className="h-12" />
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="iron" className="font-medium">
            Iron <span className="text-muted-foreground font-normal">(ppm)</span>
          </Label>
          {isPassFail ? (
            <PassFailToggle
              value={state.ironResult}
              onChange={(v) => update({ ironResult: v })}
            />
          ) : (
            <Input id="iron" type="number" min="0" step="0.01" placeholder="e.g., 0.3" value={state.iron} onChange={(e) => update({ iron: e.target.value })} className="h-12" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="tds" className="font-medium">
            TDS <span className="text-muted-foreground font-normal">(ppm)</span>
          </Label>
          {isPassFail ? (
            <PassFailToggle
              value={state.tdsResult}
              onChange={(v) => update({ tdsResult: v })}
            />
          ) : (
            <Input id="tds" type="number" min="0" placeholder="e.g., 350" value={state.tds} onChange={(e) => update({ tds: e.target.value })} className="h-12" />
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="chlorine" className="font-medium">
            Chlorine <span className="text-muted-foreground font-normal">(ppm)</span>
          </Label>
          {isPassFail ? (
            <PassFailToggle
              value={state.chlorineResult}
              onChange={(v) => update({ chlorineResult: v })}
            />
          ) : (
            <Input id="chlorine" type="number" min="0" step="0.1" placeholder="e.g., 1.5" value={state.chlorine} onChange={(e) => update({ chlorine: e.target.value })} className="h-12" />
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Label className="font-medium">pH Level</Label>
          {!isPassFail && (
            <span className="text-lg font-semibold text-primary">{state.ph[0].toFixed(1)}</span>
          )}
        </div>
        {isPassFail ? (
          <PassFailToggle
            value={state.phResult}
            onChange={(v) => update({ phResult: v })}
          />
        ) : (
          <>
            <Slider value={state.ph} onValueChange={(v) => update({ ph: v })} min={0} max={14} step={0.1} className="w-full" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0 (Acidic)</span>
              <span>7 (Neutral)</span>
              <span>14 (Alkaline)</span>
            </div>
          </>
        )}
      </div>

      <div className="space-y-2">
        <Label className="font-medium">
          Soap Test <span className="text-muted-foreground font-normal">(lather quality)</span>
        </Label>
        <PassFailToggle
          value={state.soapTestResult}
          onChange={(v) => update({ soapTestResult: v })}
        />
      </div>
    </div>
  );
}
