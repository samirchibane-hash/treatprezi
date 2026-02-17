import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowUpRight, Users, FileText, LogOut, Settings as SettingsIcon, ExternalLink, Receipt, Trash2 } from 'lucide-react';
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
import { format } from 'date-fns';

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
      toast({ title: 'Error', description: 'Failed to delete proposal.', variant: 'destructive' });
    } else {
      toast({ title: 'Deleted', description: 'Proposal has been deleted.' });
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

  const topPerformer = repStats.length > 0 ? repStats[0] : null;

  if (authLoading || !profile?.dealership_id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" message="Loading your dashboard..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors cursor-pointer">legal</span>
            <span className="text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors cursor-pointer">privacy</span>
          </div>

          <span className="text-sm font-semibold tracking-tight text-foreground">TreatEngine</span>

          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground hidden sm:block">
              {profile.full_name}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/settings')}>
              <SettingsIcon className="w-4 h-4 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* ── Hero Card ── */}
        <section className="rounded-2xl border border-border bg-card p-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-foreground uppercase leading-none">
                Proposals
              </h1>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground mt-auto mb-2">info</span>
            </div>
          </div>
          <div className="flex gap-12 text-sm">
            <div className="space-y-1">
              <p className="text-muted-foreground">{userRole?.role === 'admin' ? 'Dealership Admin' : 'Sales Rep'}</p>
              <p className="text-foreground">{profile.full_name}</p>
              <p className="text-muted-foreground">{user?.email}</p>
            </div>
          </div>
        </section>

        {/* ── Dashboard Grid ── */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Stats Card (Accent) */}
          <div className="rounded-2xl bg-accent text-accent-foreground p-6 flex flex-col justify-between min-h-[220px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-widest opacity-70">Overview</span>
              <span className="text-[10px] uppercase tracking-widest opacity-50">stats</span>
            </div>
            <div>
              <p className="text-5xl font-black tracking-tighter">{proposals.length}</p>
              <p className="text-sm font-medium mt-1 opacity-80">Total Proposals</p>
              <div className="flex gap-6 mt-4">
                <div>
                  <p className="text-2xl font-bold">{thisMonthCount}</p>
                  <p className="text-xs opacity-60">This Month</p>
                </div>
                {userRole?.role === 'admin' && (
                  <div>
                    <p className="text-2xl font-bold">{repStats.length}</p>
                    <p className="text-xs opacity-60">Active Team</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Team Card */}
          {userRole?.role === 'admin' && topPerformer && (
            <div className="rounded-2xl border border-border bg-card p-6 flex flex-col justify-between min-h-[220px]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Team</span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">members</span>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                    <span className="text-sm font-bold text-accent-foreground">
                      {topPerformer.rep_name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{topPerformer.rep_name}</p>
                    <p className="text-xs text-muted-foreground">Top Performer</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span>Performance</span>
                  <span className="text-foreground font-semibold">{topPerformer.count}</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: '100%' }} />
                </div>
              </div>
            </div>
          )}

          {/* Create New Card */}
          <div
            className="rounded-2xl border border-border bg-card p-6 flex flex-col items-center justify-center min-h-[220px] cursor-pointer hover:border-accent/50 transition-colors group"
            onClick={() => navigate('/new-proposal')}
          >
            <div className="flex items-center justify-between w-full mb-auto">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Create</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">action</span>
            </div>
            <div className="flex flex-col items-center gap-3 my-auto">
              <div className="w-12 h-12 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center group-hover:border-accent transition-colors">
                <Plus className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
              </div>
              <p className="text-sm font-semibold text-foreground">New Proposal</p>
              <p className="text-xs text-muted-foreground text-center">Start a new quote for a customer</p>
            </div>
          </div>

          {/* Recent Activity Card */}
          <div className="rounded-2xl border border-border bg-card p-6 flex flex-col justify-between min-h-[220px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Recent</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">activity</span>
            </div>
            <div className="space-y-3 mt-auto">
              {proposals.slice(0, 2).map((p) => (
                <div key={p.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-xs font-semibold text-foreground">
                        {p.customer_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{p.customer_name}</p>
                      <p className="text-[11px] text-muted-foreground">{format(new Date(p.created_at), 'MMM d')}</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              ))}
              <button
                onClick={() => document.getElementById('proposals-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View All
              </button>
            </div>
          </div>
        </section>

        {/* ── Proposals List ── */}
        <section id="proposals-section" className="animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              All Proposals
            </h2>
            <span className="text-xs text-muted-foreground">{proposals.length} items</span>
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {/* Table Header */}
            <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_auto] gap-4 px-6 py-3 border-b border-border">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">Client</span>
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">Details</span>
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">Tags</span>
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">Actions</span>
            </div>

            {loading ? (
              <div className="py-16">
                <LoadingSpinner message="Loading proposals..." />
              </div>
            ) : proposals.length === 0 ? (
              <div className="text-center py-20 px-6">
                <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-7 h-7 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">No proposals yet</h3>
                <p className="text-sm text-muted-foreground mb-5">Create your first proposal to get started.</p>
                <Button onClick={() => navigate('/new-proposal')} className="bg-accent text-accent-foreground hover:bg-accent/90">
                  <Plus className="w-4 h-4" /> Create Proposal
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {proposals.map((proposal) => {
                  const tags = [
                    proposal.home_age ? `Home: ${proposal.home_age}` : null,
                    proposal.household_size ? `${proposal.household_size} people` : null,
                    proposal.water_source || null,
                    proposal.recommended_system || null,
                  ].filter(Boolean) as string[];

                  return (
                    <div
                      key={proposal.id}
                      className="group px-6 py-4 hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => navigate(`/proposal/${proposal.id}`)}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-3 md:gap-4 items-center">
                        {/* Client */}
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-semibold text-foreground">
                              {proposal.customer_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{proposal.customer_name}</p>
                            <p className="text-[11px] text-muted-foreground">{format(new Date(proposal.created_at), 'MMM d, yyyy')}</p>
                          </div>
                        </div>

                        {/* Address */}
                        <div>
                          <p className="text-sm text-muted-foreground truncate">{proposal.address}</p>
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-1.5">
                          {tags.slice(0, 2).map((tag, i) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                              {tag}
                            </span>
                          ))}
                          {tags.length > 2 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                              +{tags.length - 2}
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                          {proposal.presentation_url && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(proposal.presentation_url!, '_blank')}>
                              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCreateInvoice(proposal)}>
                            <Receipt className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                          {proposal.created_by === user?.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              disabled={deletingId === proposal.id}
                              onClick={() => handleDeleteProposal(proposal.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
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
        <AlertDialogContent className="rounded-2xl bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Proposal?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this proposal. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
