import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Building2, Users, Send, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { StripeConnectCard } from '@/components/settings/StripeConnectCard';

interface DealershipDetails {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  invite_code: string;
}

interface TeamMember {
  user_id: string;
  full_name: string;
  email: string | null;
  role: 'admin' | 'rep';
}

export default function Settings() {
  const { user, profile, userRole, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Profile form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Dealership form state (admin only)
  const [dealership, setDealership] = useState<DealershipDetails | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);

  // Team management state (admin only)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const isAdmin = userRole?.role === 'admin';

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!authLoading && user && profile && !profile.dealership_id) {
      navigate('/onboarding');
    }
  }, [user, profile, authLoading, navigate]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      fetchProfileDetails();
    }
    if (profile?.dealership_id && isAdmin) {
      fetchDealershipDetails();
      fetchTeamMembers();
    }
  }, [profile, isAdmin]);

  const fetchProfileDetails = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('email, phone')
      .eq('user_id', user.id)
      .single();
    
    if (data) {
      setEmail(data.email || user.email || '');
      setPhone(data.phone || '');
    } else {
      setEmail(user.email || '');
    }
  };

  const fetchDealershipDetails = async () => {
    if (!profile?.dealership_id) return;
    const { data } = await supabase
      .from('dealerships')
      .select('*')
      .eq('id', profile.dealership_id)
      .single();
    
    if (data) {
      setDealership(data);
      setCompanyName(data.name);
      setCompanyAddress(data.address || '');
      setCompanyPhone(data.phone || '');
    }
  };

  const fetchTeamMembers = async () => {
    if (!profile?.dealership_id) return;
    setLoadingTeam(true);
    
    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .eq('dealership_id', profile.dealership_id);

    if (roles) {
      const userIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      if (profiles) {
        const members: TeamMember[] = roles.map(role => {
          const memberProfile = profiles.find(p => p.user_id === role.user_id);
          return {
            user_id: role.user_id,
            full_name: memberProfile?.full_name || 'Unknown',
            email: memberProfile?.email || null,
            role: role.role as 'admin' | 'rep',
          };
        });
        setTeamMembers(members);
      }
    }
    setLoadingTeam(false);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSavingProfile(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
      })
      .eq('user_id', user.id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update profile. Please try again.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Profile Updated',
        description: 'Your profile has been saved successfully.',
      });
      await refreshProfile();
    }
    setSavingProfile(false);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealership) return;

    setSavingCompany(true);
    const { error } = await supabase
      .from('dealerships')
      .update({
        name: companyName.trim(),
        address: companyAddress.trim() || null,
        phone: companyPhone.trim() || null,
      })
      .eq('id', dealership.id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update company details. Please try again.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Company Updated',
        description: 'Company details have been saved successfully.',
      });
      await fetchDealershipDetails();
    }
    setSavingCompany(false);
  };

  const handleCopyInviteCode = async () => {
    if (!dealership?.invite_code) return;
    await navigator.clipboard.writeText(dealership.invite_code);
    setCopiedCode(true);
    toast({
      title: 'Copied!',
      description: 'Invite code copied to clipboard.',
    });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (authLoading || !profile?.dealership_id) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading settings..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 h-16 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-foreground">Settings</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-4' : 'grid-cols-1'}`}>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="company" className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Company</span>
                </TabsTrigger>
                <TabsTrigger value="team" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">Team</span>
                </TabsTrigger>
                <TabsTrigger value="payments" className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  <span className="hidden sm:inline">Payments</span>
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card className="border-0 shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Your Profile
                </CardTitle>
                <CardDescription>
                  Update your personal information. This data is included when creating proposals.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your full name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <Button type="submit" variant="water" disabled={savingProfile}>
                    {savingProfile ? 'Saving...' : 'Save Changes'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Company Tab (Admin Only) */}
          {isAdmin && (
            <TabsContent value="company">
              <Card className="border-0 shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-primary" />
                    Company Details
                  </CardTitle>
                  <CardDescription>
                    Update your company information. This appears on customer proposals.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSaveCompany} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Company Name</Label>
                      <Input
                        id="companyName"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Your company name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyAddress">Address</Label>
                      <Input
                        id="companyAddress"
                        value={companyAddress}
                        onChange={(e) => setCompanyAddress(e.target.value)}
                        placeholder="123 Main St, City, State 12345"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyPhone">Phone</Label>
                      <Input
                        id="companyPhone"
                        type="tel"
                        value={companyPhone}
                        onChange={(e) => setCompanyPhone(e.target.value)}
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <Button type="submit" variant="water" disabled={savingCompany}>
                      {savingCompany ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Team Tab (Admin Only) */}
          {isAdmin && (
            <TabsContent value="team">
              <div className="space-y-6">
                {/* Invite Section */}
                <Card className="border-0 shadow-soft">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Send className="w-5 h-5 text-primary" />
                      Invite Team Members
                    </CardTitle>
                    <CardDescription>
                      Share your invite code with new team members so they can join your company.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 p-3 bg-muted rounded-lg font-mono text-lg text-center tracking-wider">
                        {dealership?.invite_code || '--------'}
                      </div>
                      <Button variant="outline" onClick={handleCopyInviteCode}>
                        {copiedCode ? 'Copied!' : 'Copy'}
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      New users can enter this code during signup to join your company as a Sales Rep.
                    </p>
                  </CardContent>
                </Card>

                {/* Team Members List */}
                <Card className="border-0 shadow-soft">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" />
                      Team Members
                    </CardTitle>
                    <CardDescription>
                      View and manage your team members.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loadingTeam ? (
                      <LoadingSpinner message="Loading team..." />
                    ) : teamMembers.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">
                        No team members yet. Share your invite code to add members.
                      </p>
                    ) : (
                      <div className="divide-y divide-border">
                        {teamMembers.map((member) => (
                          <div
                            key={member.user_id}
                            className="py-3 flex items-center justify-between"
                          >
                            <div>
                              <p className="font-medium text-foreground">{member.full_name}</p>
                              {member.email && (
                                <p className="text-sm text-muted-foreground">{member.email}</p>
                              )}
                            </div>
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${
                                member.role === 'admin'
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-secondary text-secondary-foreground'
                              }`}
                            >
                              {member.role === 'admin' ? 'Admin' : 'Rep'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          {/* Payments Tab (Admin Only) */}
          {isAdmin && (
            <TabsContent value="payments">
              <StripeConnectCard />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}
