import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Users, TrendingUp, Droplet, LogOut, Settings as SettingsIcon, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { CreateInvoiceDialog } from '@/components/invoice/CreateInvoiceDialog';
import { ProposalDetailCard } from '@/components/proposal/ProposalDetailCard';

interface Proposal {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  address: string;
  recommended_system: string;
  presentation_url: string | null;
  created_at: string;
  created_by: string;
  dealership_id: string;
  home_age: string | null;
  household_size: string | null;
  num_showers: string | null;
  num_bathrooms: string | null;
  bottled_water_cases: string | null;
  water_source: string | null;
  has_dishwasher: boolean | null;
  has_dryer: boolean | null;
  has_water_heater: boolean | null;
  has_ice_maker: boolean | null;
  water_concerns: string | null;
  hardness: number | null;
  iron: number | null;
  tds: number | null;
  ph: number | null;
  chlorine: number | null;
}

interface RepStats {
  rep_name: string;
  count: number;
}

export default function Dashboard() {
  const { user, profile, userRole, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [repStats, setRepStats] = useState<RepStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [proposalToDelete, setProposalToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!authLoading && user && profile && !profile.dealership_id) {
      navigate('/onboarding');
    }
  }, [user, profile, authLoading, navigate]);

  useEffect(() => {
    if (profile?.dealership_id) {
      fetchProposals();
      if (userRole?.role === 'admin') {
        fetchRepStats();
      }
    }
  }, [profile, userRole]);

  const fetchProposals = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('proposals')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setProposals(data);
    }
    setLoading(false);
  };

  const fetchRepStats = async () => {
    const { data: proposalsData } = await supabase
      .from('proposals')
      .select('created_by');

    if (proposalsData) {
      const userIds = [...new Set(proposalsData.map((p) => p.created_by))];
      
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      if (profilesData) {
        const stats: { [key: string]: { name: string; count: number } } = {};
        
        proposalsData.forEach((proposal) => {
          const prof = profilesData.find((p) => p.user_id === proposal.created_by);
          const name = prof?.full_name || 'Unknown';
          if (!stats[proposal.created_by]) {
            stats[proposal.created_by] = { name, count: 0 };
          }
          stats[proposal.created_by].count++;
        });

        setRepStats(
          Object.values(stats)
            .map((s) => ({ rep_name: s.name, count: s.count }))
            .sort((a, b) => b.count - a.count)
        );
      }
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleDeleteProposal = async (proposalId: string) => {
    setProposalToDelete(proposalId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!proposalToDelete) return;
    setDeletingId(proposalToDelete);
    const { error } = await supabase
      .from('proposals')
      .delete()
      .eq('id', proposalToDelete);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete proposal. Please try again.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Deleted',
        description: 'Proposal has been deleted.',
      });
      setProposals((prev) => prev.filter((p) => p.id !== proposalToDelete));
    }
    setDeletingId(null);
    setDeleteDialogOpen(false);
    setProposalToDelete(null);
  };

  const handleCreateInvoice = (proposal: Proposal) => {
    setSelectedProposal(proposal);
    setInvoiceDialogOpen(true);
  };

  const thisMonthCount = proposals.filter((p) => {
    const d = new Date(p.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  if (authLoading || !profile?.dealership_id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" message="Loading your dashboard..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Apple-style frosted navbar */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-xl backdrop-saturate-150">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 gradient-water rounded-lg flex items-center justify-center">
              <Droplet className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-[15px] tracking-tight text-foreground">TreatEngine</span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[13px] text-muted-foreground hidden sm:block mr-2">
              {profile.full_name}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => navigate('/settings')}>
              <SettingsIcon className="w-4 h-4 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Greeting */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {profile.full_name?.split(' ')[0]}
          </h1>
          <p className="text-[15px] text-muted-foreground mt-1">
            Here's what's happening with your proposals.
          </p>
        </div>

        {/* Metric tiles — Apple widget style */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          <MetricTile
            label="Total Proposals"
            value={proposals.length}
            icon={<FileText className="w-5 h-5" />}
            color="primary"
          />
          {userRole?.role === 'admin' && (
            <MetricTile
              label="Team Members"
              value={repStats.length}
              icon={<Users className="w-5 h-5" />}
              color="accent"
            />
          )}
          <MetricTile
            label="This Month"
            value={thisMonthCount}
            icon={<TrendingUp className="w-5 h-5" />}
            color="accent"
          />
        </div>

        {/* New Proposal CTA */}
        <div className="mb-10">
          <Button
            onClick={() => navigate('/new-proposal')}
            className="h-11 px-6 rounded-xl bg-primary text-primary-foreground font-medium text-[14px] shadow-sm hover:bg-primary/90 active:scale-[0.98] transition-all"
          >
            <Plus className="w-4 h-4" />
            New Proposal
          </Button>
        </div>

        {/* Admin: Team Performance */}
        {userRole?.role === 'admin' && repStats.length > 0 && (
          <section className="mb-10 animate-fade-in">
            <h2 className="text-lg font-semibold tracking-tight text-foreground mb-4">Team Performance</h2>
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
              {repStats.map((stat) => (
                <div key={stat.rep_name} className="flex items-center justify-between gap-4">
                  <span className="text-[14px] font-medium text-foreground truncate">{stat.rep_name}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-28 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${(stat.count / Math.max(...repStats.map((s) => s.count))) * 100}%` }}
                      />
                    </div>
                    <span className="text-[13px] font-semibold text-muted-foreground tabular-nums w-6 text-right">
                      {stat.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Proposals list */}
        <section className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {userRole?.role === 'admin' ? 'All Proposals' : 'Your Proposals'}
            </h2>
            <span className="text-[13px] text-muted-foreground">{proposals.length} total</span>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
            {loading ? (
              <div className="py-16">
                <LoadingSpinner message="Loading proposals..." />
              </div>
            ) : proposals.length === 0 ? (
              <div className="text-center py-20 px-6">
                <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-7 h-7 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-foreground mb-1 text-[15px]">No proposals yet</h3>
                <p className="text-[13px] text-muted-foreground mb-5">
                  Create your first proposal to get started.
                </p>
                <Button
                  onClick={() => navigate('/new-proposal')}
                  className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-[13px] font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Create Proposal
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {proposals.map((proposal, i) => (
                  <ProposalDetailCard
                    key={proposal.id}
                    proposal={proposal}
                    onDelete={handleDeleteProposal}
                    onCreateInvoice={handleCreateInvoice}
                    isDeleting={deletingId === proposal.id}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <CreateInvoiceDialog
        proposal={selectedProposal}
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[17px]">Delete Proposal?</AlertDialogTitle>
            <AlertDialogDescription className="text-[14px]">
              This will permanently delete this proposal. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl text-[13px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="rounded-xl text-[13px] bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ── Metric Tile ── */
function MetricTile({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: 'primary' | 'accent' }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 flex items-center justify-between transition-shadow hover:shadow-soft">
      <div>
        <p className="text-[13px] text-muted-foreground font-medium">{label}</p>
        <p className="text-3xl font-bold tracking-tight text-foreground mt-1 tabular-nums">{value}</p>
      </div>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
        color === 'primary' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'
      }`}>
        {icon}
      </div>
    </div>
  );
}
