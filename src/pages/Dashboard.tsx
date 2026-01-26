import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, ExternalLink, Users, TrendingUp, Droplet, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/LoadingSpinner';
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

interface RepStats {
  rep_name: string;
  count: number;
}

export default function Dashboard() {
  const { user, profile, userRole, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [repStats, setRepStats] = useState<RepStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!authLoading && user && profile && !profile.dealership_id) {
      // Only redirect to onboarding if profile is loaded AND dealership_id is missing
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
          const profile = profilesData.find((p) => p.user_id === proposal.created_by);
          const name = profile?.full_name || 'Unknown';
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

  if (authLoading || !profile?.dealership_id) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading your dashboard..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 gradient-water rounded-xl flex items-center justify-center shadow-sm">
              <Droplet className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-foreground">TreatEngine</h1>
              <p className="text-xs text-muted-foreground capitalize">
                {userRole?.role === 'admin' ? 'Dealership Admin' : 'Sales Rep'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {profile.full_name}
            </span>
            <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
              <SettingsIcon className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-0 shadow-soft">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Total Proposals</p>
                  <p className="text-3xl font-bold text-foreground">{proposals.length}</p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          {userRole?.role === 'admin' && (
            <Card className="border-0 shadow-soft">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Team Members</p>
                    <p className="text-3xl font-bold text-foreground">{repStats.length}</p>
                  </div>
                  <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-accent" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-0 shadow-soft">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">This Month</p>
                  <p className="text-3xl font-bold text-foreground">
                    {proposals.filter((p) => {
                      const proposalDate = new Date(p.created_at);
                      const now = new Date();
                      return (
                        proposalDate.getMonth() === now.getMonth() &&
                        proposalDate.getFullYear() === now.getFullYear()
                      );
                    }).length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-teal-500/10 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-teal-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <Button variant="water" size="lg" onClick={() => navigate('/new-proposal')}>
            <Plus className="w-5 h-5" />
            New Proposal
          </Button>
        </div>

        {/* Admin: Rep Stats */}
        {userRole?.role === 'admin' && repStats.length > 0 && (
          <Card className="mb-8 border-0 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Team Performance
              </CardTitle>
              <CardDescription>Proposals generated by each team member</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {repStats.map((stat) => (
                  <div key={stat.rep_name} className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{stat.rep_name}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full gradient-water rounded-full transition-all duration-500"
                          style={{
                            width: `${(stat.count / Math.max(...repStats.map((s) => s.count))) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-muted-foreground w-8 text-right">
                        {stat.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Proposals List */}
        <Card className="border-0 shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Recent Proposals
            </CardTitle>
            <CardDescription>
              {userRole?.role === 'admin' ? 'All proposals from your dealership' : 'Your generated proposals'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12">
                <LoadingSpinner message="Loading proposals..." />
              </div>
            ) : proposals.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">No proposals yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first proposal to get started
                </p>
                <Button variant="water" onClick={() => navigate('/new-proposal')}>
                  <Plus className="w-4 h-4" />
                  Create Proposal
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {proposals.map((proposal) => (
                  <div
                    key={proposal.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-foreground truncate">
                        {proposal.customer_name}
                      </h4>
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
                    {proposal.presentation_url ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(proposal.presentation_url!, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4" />
                        View
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Generating...</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
