import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useProposalWizard } from '@/hooks/useProposalWizard';
import { StepSidebar, MobileStepIndicator, STEPS } from '@/components/proposal/wizard/StepSidebar';
import { CustomerInfoStep } from '@/components/proposal/wizard/CustomerInfoStep';
import { LocationStep } from '@/components/proposal/wizard/LocationStep';
import { HouseholdStep } from '@/components/proposal/wizard/HouseholdStep';
import { WaterTestStep } from '@/components/proposal/wizard/WaterTestStep';
import { PresentationStep } from '@/components/proposal/wizard/PresentationStep';
import { ProductSelectionStep } from '@/components/proposal/wizard/ProductSelectionStep';
import { InvoiceStep } from '@/components/proposal/wizard/InvoiceStep';
import { ContractStep } from '@/components/proposal/wizard/ContractStep';
import { InstallDetailsStep } from '@/components/proposal/wizard/InstallDetailsStep';

const STEP_META: Record<number, { title: string; description: string }> = {
  1: { title: 'Customer Information', description: "Enter the customer's contact details" },
  2: { title: 'Service Location', description: 'Where will the system be installed?' },
  3: { title: 'Household Details', description: 'Tell us about the home and water usage' },
  4: { title: 'Water Test Results', description: 'Enter water quality test measurements' },
  5: { title: 'Presentation', description: 'Save proposal and generate the presentation' },
  6: { title: 'Choose Products', description: 'Select products/services for this customer' },
  7: { title: 'Generate Invoice', description: 'Create a payment link for the customer' },
  8: { title: 'Contract', description: 'Generate and manage the contract' },
  9: { title: 'Install Details', description: 'Photos, install date, and completion details' },
};

export default function NewProposal() {
  const navigate = useNavigate();
  const { state, update, setStep, canProceed } = useProposalWizard();
  const { currentStep } = state;
  const meta = STEP_META[currentStep];
  const totalSteps = STEPS.length;

  const handleNext = () => {
    if (currentStep < totalSteps) setStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setStep(currentStep - 1);
  };

  // Steps 5+ that require proposal to be saved first
  const requiresProposal = currentStep >= 5 && !state.proposalId;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 h-16 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </button>
          <div className="h-6 w-px bg-border" />
          <div>
            <h1 className="font-bold text-foreground">New Proposal</h1>
            {state.customerName && (
              <p className="text-xs text-muted-foreground">{state.customerName}</p>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Vertical sidebar */}
          <StepSidebar
            currentStep={currentStep}
            proposalId={state.proposalId}
            onStepClick={setStep}
          />

          {/* Main content */}
          <div className="flex-1 max-w-2xl">
            <MobileStepIndicator currentStep={currentStep} />

            <Card className="shadow-soft border-0 animate-fade-in">
              <CardHeader>
                <CardTitle>{meta.title}</CardTitle>
                <CardDescription>{meta.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {currentStep === 1 && <CustomerInfoStep state={state} update={update} />}
                {currentStep === 2 && <LocationStep state={state} update={update} />}
                {currentStep === 3 && <HouseholdStep state={state} update={update} />}
                {currentStep === 4 && <WaterTestStep state={state} update={update} />}
                {currentStep === 5 && <PresentationStep state={state} update={update} />}
                {currentStep === 6 && (requiresProposal ? (
                  <p className="text-center py-8 text-muted-foreground">Save the proposal in the Presentation step first.</p>
                ) : <ProductSelectionStep state={state} update={update} />)}
                {currentStep === 7 && (requiresProposal ? (
                  <p className="text-center py-8 text-muted-foreground">Save the proposal in the Presentation step first.</p>
                ) : <InvoiceStep state={state} update={update} />)}
                {currentStep === 8 && <ContractStep state={state} />}
                {currentStep === 9 && <InstallDetailsStep state={state} update={update} />}

                {/* Navigation */}
                <div className="flex justify-between pt-6 border-t">
                  <Button variant="ghost" onClick={handleBack} disabled={currentStep === 1}>
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </Button>

                  {currentStep < totalSteps && (
                    <Button
                      variant="water"
                      onClick={handleNext}
                      disabled={!canProceed() && currentStep <= 4}
                    >
                      Continue
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  )}

                  {currentStep === totalSteps && (
                    <Button variant="water" onClick={() => navigate(`/proposal/${state.proposalId}`)}>
                      View Customer Profile
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
