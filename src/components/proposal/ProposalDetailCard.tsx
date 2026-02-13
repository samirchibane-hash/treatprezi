import { useNavigate } from 'react-router-dom';
import { User, Receipt, ExternalLink, Trash2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

interface Proposal {
  id: string;
  customer_name: string;
  address: string;
  recommended_system: string;
  presentation_url: string | null;
  created_at: string;
  created_by: string;
}

interface ProposalDetailCardProps {
  proposal: Proposal;
  onDelete: (id: string) => void;
  onCreateInvoice: (proposal: any) => void;
  isDeleting: boolean;
}

export function ProposalDetailCard({ proposal, onDelete, onCreateInvoice, isDeleting }: ProposalDetailCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="group px-5 py-4 transition-colors hover:bg-muted/30">
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-primary/8 flex items-center justify-center flex-shrink-0">
          <span className="text-[13px] font-semibold text-primary">
            {proposal.customer_name.charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Content — clickable */}
        <button
          className="flex-1 min-w-0 text-left"
          onClick={() => navigate(`/proposal/${proposal.id}`)}
        >
          <div className="flex items-center gap-2">
            <h4 className="text-[14px] font-semibold text-foreground truncate">
              {proposal.customer_name}
            </h4>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>
          <p className="text-[12px] text-muted-foreground truncate mt-0.5">
            {proposal.address}
          </p>
        </button>

        {/* System badge */}
        <span className="hidden md:inline-flex text-[11px] font-medium text-secondary-foreground bg-secondary px-2.5 py-1 rounded-lg flex-shrink-0">
          {proposal.recommended_system}
        </span>

        {/* Date */}
        <span className="hidden sm:block text-[12px] text-muted-foreground tabular-nums flex-shrink-0 w-20 text-right">
          {format(new Date(proposal.created_at), 'MMM d, yyyy')}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {proposal.presentation_url ? (
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => window.open(proposal.presentation_url!, '_blank')}>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
          ) : (
            <span className="text-[11px] text-muted-foreground italic mr-1">Generating…</span>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => onCreateInvoice(proposal)}>
            <Receipt className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
          {proposal.created_by === user?.id && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              disabled={isDeleting}
              onClick={() => onDelete(proposal.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
