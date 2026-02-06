import { useState, useEffect } from 'react';
import { Sparkles, ExternalLink, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { HOME_AGE_OPTIONS, HOUSEHOLD_SIZE_OPTIONS, WATER_SOURCE_OPTIONS } from '@/hooks/useProposalWizard';
import type { WizardState } from '@/hooks/useProposalWizard';

interface Props {
  state: WizardState;
  update: (partial: Partial<WizardState>) => void;
}

export function PresentationStep({ state, update }: Props) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [polling, setPolling] = useState(false);

  // Poll for presentation URL if proposal saved but no URL yet
  useEffect(() => {
    if (!state.proposalId || state.presentationUrl) return;
    setPolling(true);
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('proposals')
        .select('presentation_url')
        .eq('id', state.proposalId!)
        .single();
      if (data?.presentation_url) {
        update({ presentationUrl: data.presentation_url });
        setPolling(false);
        clearInterval(interval);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [state.proposalId, state.presentationUrl]);

  const handleGenerate = async () => {
    if (!user || !profile?.dealership_id) return;
    update({ isGenerating: true });

    try {
      const { data: repProfile } = await supabase
        .from('profiles')
        .select('full_name, email, phone')
        .eq('user_id', user.id)
        .single();

      const { data: dealership } = await supabase
        .from('dealerships')
        .select('name, address, phone')
        .eq('id', profile.dealership_id)
        .single();

      const homeAgeLabel = HOME_AGE_OPTIONS.find((o) => o.value === state.homeAge)?.label || state.homeAge;
      const householdLabel = HOUSEHOLD_SIZE_OPTIONS.find((o) => o.value === state.householdSize)?.label || state.householdSize;
      const waterSourceLabel = WATER_SOURCE_OPTIONS.find((o) => o.value === state.waterSource)?.label || state.waterSource;

      const { data: proposal, error } = await supabase
        .from('proposals')
        .insert({
          customer_name: state.customerName,
          customer_email: state.customerEmail.trim() || null,
          customer_phone: state.customerPhone.trim() || null,
          address: `${state.street}, ${state.city}, ${state.state} ${state.zipCode}`,
          recommended_system: `Home: ${homeAgeLabel}, ${householdLabel}, ${waterSourceLabel}`,
          dealership_id: profile.dealership_id,
          created_by: user.id,
          home_age: homeAgeLabel,
          household_size: householdLabel,
          num_showers: state.numShowers || null,
          num_bathrooms: state.numBathrooms || null,
          bottled_water_cases: state.bottledWaterCases || null,
          water_source: waterSourceLabel,
          has_dishwasher: state.hasDishwasher,
          has_dryer: state.hasDryer,
          has_water_heater: state.hasWaterHeater,
          has_ice_maker: state.hasIceMaker,
          water_concerns: state.waterConcerns.trim() || null,
          hardness: state.hardness ? parseFloat(state.hardness) : null,
          iron: state.iron ? parseFloat(state.iron) : null,
          tds: state.tds ? parseFloat(state.tds) : null,
          ph: state.ph[0],
          chlorine: state.chlorine ? parseFloat(state.chlorine) : null,
        })
        .select()
        .single();

      if (error) throw error;

      update({
        proposalId: proposal.id,
        customerEmailForInvoice: state.customerEmail,
      });

      // Fire n8n webhook
      fetch('https://n8n.srv1297035.hstgr.cloud/webhook/e36c484d-ce4c-4f8e-bb75-9ad945c9ef7b', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: state.customerName,
          customerEmail: state.customerEmail.trim() || null,
          customerPhone: state.customerPhone.trim() || null,
          street: state.street,
          city: state.city,
          state: state.state,
          zipCode: state.zipCode,
          address: `${state.street}, ${state.city}, ${state.state} ${state.zipCode}`,
          homeAge: homeAgeLabel,
          householdSize: householdLabel,
          numShowers: state.numShowers || null,
          numBathrooms: state.numBathrooms || null,
          bottledWaterCases: state.bottledWaterCases || null,
          waterSource: waterSourceLabel,
          hasDishwasher: state.hasDishwasher,
          hasDryer: state.hasDryer,
          hasWaterHeater: state.hasWaterHeater,
          hasIceMaker: state.hasIceMaker,
          waterConcerns: state.waterConcerns.trim() || null,
          hardness: state.hardness ? parseFloat(state.hardness) : null,
          iron: state.iron ? parseFloat(state.iron) : null,
          tds: state.tds ? parseFloat(state.tds) : null,
          ph: state.ph[0],
          chlorine: state.chlorine ? parseFloat(state.chlorine) : null,
          proposalId: proposal.id,
          repName: repProfile?.full_name || profile.full_name,
          repEmail: repProfile?.email || user.email,
          repPhone: repProfile?.phone || null,
          companyName: dealership?.name || null,
          companyAddress: dealership?.address || null,
          companyPhone: dealership?.phone || null,
        }),
      }).catch((err) => console.error('Failed to trigger webhook:', err));

      toast({ title: 'Proposal saved!', description: 'Presentation is being generated...' });
    } catch (error) {
      console.error('Error:', error);
      toast({ title: 'Error', description: 'Failed to save proposal.', variant: 'destructive' });
    } finally {
      update({ isGenerating: false });
    }
  };

  // Already saved
  if (state.proposalId) {
    return (
      <div className="text-center py-8 space-y-6">
        <div className="w-16 h-16 gradient-water rounded-full flex items-center justify-center mx-auto shadow-water">
          <CheckCircle2 className="w-8 h-8 text-primary-foreground" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Proposal Saved!</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {state.presentationUrl
              ? 'Your presentation is ready.'
              : 'Your presentation is being generated...'}
          </p>
        </div>
        {state.presentationUrl ? (
          <Button variant="outline" onClick={() => window.open(state.presentationUrl!, '_blank')}>
            <ExternalLink className="w-4 h-4" />
            View Presentation
          </Button>
        ) : polling ? (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Waiting for presentation...</span>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="text-center py-8 space-y-6">
      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
        <Sparkles className="w-8 h-8 text-primary" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground">Ready to Generate</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Save the proposal and generate a customized presentation for {state.customerName}.
        </p>
      </div>
      <Button variant="water" size="lg" onClick={handleGenerate} disabled={state.isGenerating}>
        {state.isGenerating ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
        ) : (
          <><Sparkles className="w-4 h-4" /> Save & Generate Presentation</>
        )}
      </Button>
    </div>
  );
}
