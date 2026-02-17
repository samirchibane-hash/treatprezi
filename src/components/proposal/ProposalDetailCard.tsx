import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface Proposal {
  id: string;
  customer_name: string;
  address: string;
  recommended_system: string;
  presentation_url: string | null;
  created_at: string;
  created_by: string;
  stage?: string;
  invoice_amount_cents?: number | null;
}

interface ProposalDetailCardProps {
  proposal: Proposal;
  onDelete: (id: string) => void;
  onCreateInvoice: (proposal: any) => void;
  isDeleting: boolean;
}

const STAGE_LABELS: Record<string, { label: string; className: string }> = {
  draft:           { label: 'Draft',         className: 'bg-secondary text-secondary-foreground' },
  presented:       { label: 'Presented',     className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  follow_up:       { label: 'Follow Up',     className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
  not_qualified:   { label: 'Not Qualified', className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  not_interested:  { label: 'Not Interested','className': 'bg-red-500/10 text-red-600 dark:text-red-400' },
  closed:          { label: 'Closed',        className: 'bg-green-500/10 text-green-600 dark:text-green-400' },
};

export function ProposalDetailCard({ proposal, onDelete, onCreateInvoice, isDeleting }: ProposalDetailCardProps) {
  const navigate = useNavigate();
  const stage = STAGE_LABELS[proposal.stage ?? 'draft'] ?? STAGE_LABELS['draft'];

  const formattedValue = proposal.invoice_amount_cents != null
    ? `$${(proposal.invoice_amount_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : '—';

  return (
    <div className="group grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/30">
      {/* Full Name */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <span className="text-[12px] font-semibold text-primary">
            {proposal.customer_name.charAt(0).toUpperCase()}
          </span>
        </div>
        <span className="text-[13px] font-medium text-foreground truncate">
          {proposal.customer_name}
        </span>
      </div>

      {/* Proposal Value */}
      <span className="text-[13px] text-foreground tabular-nums">
        {formattedValue}
      </span>

      {/* Stage */}
      <span className={`inline-flex w-fit text-[11px] font-medium px-2.5 py-1 rounded-lg ${stage.className}`}>
        {stage.label}
      </span>

      {/* Date Created */}
      <span className="text-[12px] text-muted-foreground tabular-nums">
        {format(new Date(proposal.created_at), 'MMM d, yyyy')}
      </span>

      {/* Expand button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => navigate(`/proposal/${proposal.id}`)}
      >
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </Button>
    </div>
  );
}
