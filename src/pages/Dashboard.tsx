import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, FileText, Droplet, LogOut, Settings as SettingsIcon,
  Search, Filter, Download, LayoutDashboard, Trophy, Bell, Menu, X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
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
import { LeaderboardCard, type LeaderEntry } from '@/components/dashboard/LeaderboardCard';
import { UpdatesCard, type Announcement } from '@/components/dashboard/UpdatesCard';
import { cn } from '@/lib/utils';

type Tab = 'overview' | 'leaderboard' | 'updates';

const NAV: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'All Proposals', icon: LayoutDashboard },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { id: 'updates', label: 'Updates', icon: Bell },
];

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
  stage: string;
}

export default function Dashboard() {
  const { user, profile, userRole, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [proposalValues, setProposalValues] = useState<Record<string, number>>({});
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [revenueThisMonth, setRevenueThisMonth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [proposalToDelete, setProposalToDelete] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
    else if (!authLoading && user && profile && !profile.dealership_id) navigate('/onboarding');
  }, [user, profile, authLoading, navigate]);

  useEffect(() => {
    if (profile?.dealership_id) {
      fetchProposals();
      fetchRevenueAndLeaderboard();
      fetchAnnouncements();
      fetchProposalValues();
    }
  }, [profile, userRole]);

  const fetchProposals = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('proposals')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setProposals(data);
    setLoading(false);
  };

  const fetchProposalValues = async () => {
    const { data } = await supabase
      .from('proposal_products' as any)
      .select('proposal_id, products(price_cents)');
    if (data) {
      const map: Record<string, number> = {};
      (data as any[]).forEach((row) => {
        const cents = row.products?.price_cents ?? 0;
        map[row.proposal_id] = (map[row.proposal_id] ?? 0) + cents;
      });
      setProposalValues(map);
    }
  };

  const fetchRevenueAndLeaderboard = async () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const { data: invoicesData } = await supabase
      .from('invoices')
      .select('amount_cents, created_by, status')
      .gte('created_at', startOfMonth)
      .lte('created_at', endOfMonth);

    if (!invoicesData) return;

    const totalRevenue = invoicesData
      .filter((inv) => inv.status === 'paid')
      .reduce((sum, inv) => sum + inv.amount_cents, 0);
    setRevenueThisMonth(totalRevenue);

    const repRevenue: { [userId: string]: number } = {};
    invoicesData
      .filter((inv) => inv.status === 'paid')
      .forEach((inv) => {
        repRevenue[inv.created_by] = (repRevenue[inv.created_by] || 0) + inv.amount_cents;
      });

    const userIds = Object.keys(repRevenue);
    if (userIds.length === 0) { setLeaderboard([]); return; }

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', userIds);

    if (profilesData) {
      const entries: LeaderEntry[] = userIds
        .map((uid) => {
          const prof = profilesData.find((p) => p.user_id === uid);
          return { rep_name: prof?.full_name || 'Unknown', revenue_cents: repRevenue[uid], proposal_count: 0 };
        })
        .sort((a, b) => b.revenue_cents - a.revenue_cents)
        .slice(0, 5);
      setLeaderboard(entries);
    }
  };

  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setAnnouncements(data as Announcement[]);
  };

  const handleSignOut = async () => { await signOut(); navigate('/auth'); };

  const handleDeleteProposal = (proposalId: string) => {
    setProposalToDelete(proposalId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!proposalToDelete) return;
    setDeletingId(proposalToDelete);
    const { error } = await supabase.from('proposals').delete().eq('id', proposalToDelete);
    if (error) {
      toast({ title: 'Error', description: 'Failed to delete proposal.', variant: 'destructive' });
    } else {
      toast({ title: 'Deleted' });
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

  if (authLoading || !profile?.dealership_id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" message="Loading your dashboard..." />
      </div>
    );
  }

  const handleTabClick = (tab: Tab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  // ── Sidebar ──────────────────────────────────────────────────────────
  const sidebar = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border/50 flex-shrink-0">
        <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
          <Droplet className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-bold text-[17px] tracking-tight text-foreground">TreatEngine</span>
      </div>

      {/* New Proposal CTA */}
      <div className="px-4 pt-5 pb-3">
        <Button
          className="w-full h-10 rounded-xl text-[13px] font-semibold bg-primary hover:bg-primary/90"
          onClick={() => navigate('/new-proposal')}
        >
          <Plus className="w-3.5 h-3.5" />
          New Proposal
        </Button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleTabClick(id)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-[13px] font-medium transition-colors',
              activeTab === id
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            )}
          >
            <Icon className={cn('w-4 h-4 flex-shrink-0', activeTab === id ? 'text-primary' : 'text-muted-foreground')} />
            {label}
          </button>
        ))}

        <div className="pt-1 border-t border-border/40 mt-1">
          <button
            onClick={() => navigate('/settings')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-[13px] font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
          >
            <SettingsIcon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
            Settings
          </button>
        </div>
      </nav>

      {/* User + logout */}
      <div className="px-4 py-4 border-t border-border/50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
            <span className="text-[12px] font-bold text-primary">
              {profile.full_name?.charAt(0).toUpperCase() ?? '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-foreground truncate">{profile.full_name}</p>
            <p className="text-[11px] text-muted-foreground capitalize">{userRole?.role ?? 'Rep'}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors flex-shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  // ── Tab content ───────────────────────────────────────────────────────
  const filteredProposals = proposals.filter(
    (p) => !search || p.customer_name.toLowerCase().includes(search.toLowerCase())
  );

  const overviewContent = (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary">All Proposals</h1>
        <p className="text-[14px] text-muted-foreground mt-0.5">Manage and track all your client proposals.</p>
      </div>

      {/* Proposals list */}
      <section>
        <div className="flex items-center justify-end mb-4 gap-2">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search contacts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-9 pr-3 w-48 rounded-xl text-[13px] bg-card border-border/60 focus-visible:ring-1"
              />
            </div>
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-border/60 bg-card">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-border/60 bg-card">
              <Download className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          {loading ? (
            <div className="py-16"><LoadingSpinner message="Loading proposals..." /></div>
          ) : proposals.length === 0 ? (
            <div className="text-center py-20 px-6">
              <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileText className="w-7 h-7 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-1 text-[15px]">No proposals yet</h3>
              <p className="text-[13px] text-muted-foreground mb-5">Create your first proposal to get started.</p>
              <Button onClick={() => navigate('/new-proposal')} className="h-10 px-5 rounded-xl text-[13px] font-medium">
                <Plus className="w-4 h-4" /> Create Proposal
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 px-5 py-3 border-b border-border/50 bg-card">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Full Name</span>
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Proposal Value</span>
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Stage</span>
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Date Created</span>
                <span className="w-8" />
              </div>
              <div className="divide-y divide-border/50">
                {filteredProposals.map((proposal) => (
                  <ProposalDetailCard
                    key={proposal.id}
                    proposal={{ ...proposal, invoice_amount_cents: proposalValues[proposal.id] ?? null }}
                    onDelete={handleDeleteProposal}
                    onCreateInvoice={handleCreateInvoice}
                    isDeleting={deletingId === proposal.id}
                  />
                ))}
                {filteredProposals.length === 0 && (
                  <div className="text-center py-10 text-[13px] text-muted-foreground">
                    No contacts match "{search}"
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );

  const leaderboardContent = (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary">Leaderboard</h1>
        <p className="text-[14px] text-muted-foreground mt-0.5">Top performing reps this month</p>
      </div>
      <LeaderboardCard entries={leaderboard} />
    </div>
  );

  const updatesContent = (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-primary">Updates</h1>
        <p className="text-[14px] text-muted-foreground mt-0.5">Team announcements and news</p>
      </div>
      <UpdatesCard
        announcements={announcements}
        isAdmin={userRole?.role === 'admin'}
        dealershipId={profile.dealership_id}
        userId={user!.id}
        onAnnouncementAdded={(a) => setAnnouncements((prev) => [a, ...prev])}
        onAnnouncementDeleted={(id) => setAnnouncements((prev) => prev.filter((a) => a.id !== id))}
      />
    </div>
  );

  const tabContent = {
    overview: overviewContent,
    leaderboard: leaderboardContent,
    updates: updatesContent,
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">

      {/* ── Desktop sidebar ──────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-56 lg:w-60 flex-shrink-0 border-r border-border/50 bg-card">
        {sidebar}
      </aside>

      {/* ── Mobile sidebar overlay ───────────────────────────────────── */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-60 bg-card border-r border-border/50 flex flex-col">
            {sidebar}
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* ── Main area ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 h-14 border-b border-border/50 bg-card flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <Droplet className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-[15px] tracking-tight text-foreground">TreatEngine</span>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-8 animate-fade-in">
            {tabContent[activeTab]}
          </div>
        </main>
      </div>

      {/* ── Dialogs ──────────────────────────────────────────────────── */}
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
