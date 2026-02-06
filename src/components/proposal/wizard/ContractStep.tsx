import { ContractsTab } from '@/components/proposal/ContractsTab';
import type { WizardState } from '@/hooks/useProposalWizard';

interface Props {
  state: WizardState;
}

export function ContractStep({ state }: Props) {
  if (!state.proposalId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Save the proposal first to generate contracts.</p>
      </div>
    );
  }

  return (
    <ContractsTab proposalId={state.proposalId} customerName={state.customerName} />
  );
}
