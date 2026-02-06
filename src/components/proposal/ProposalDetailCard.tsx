import { useNavigate } from 'react-router-dom';
import { User, Receipt, ExternalLink, Trash2 } from 'lucide-react';
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
    <div className="py-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          className="flex-1 min-w-0 text-left hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors"
          onClick={() => navigate(`/proposal/${proposal.id}`)}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-foreground truncate">{proposal.customer_name}</h4>
              <p className="text-sm text-muted-foreground truncate">{proposal.address}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-md">
                  {proposal.recommended_system}
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(proposal.created_at), 'MMM d, yyyy')}
                </span>
              </div>
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2 flex-shrink-0">
          {proposal.presentation_url ? (
            <Button variant="outline" size="sm" onClick={() => window.open(proposal.presentation_url!, '_blank')}>
              <ExternalLink className="w-4 h-4" />
              View
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground italic">Generating...</span>
          )}
          <Button variant="outline" size="sm" onClick={() => onCreateInvoice(proposal)}>
            <Receipt className="w-4 h-4" />
            Invoice
          </Button>
          {proposal.created_by === user?.id && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              disabled={isDeleting}
              onClick={() => onDelete(proposal.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
