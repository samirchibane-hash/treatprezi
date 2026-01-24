import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Users, ArrowRight, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WaterBackground } from '@/components/WaterBackground';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

type OnboardingStep = 'choice' | 'create' | 'join';

export default function Onboarding() {
  const [step, setStep] = useState<OnboardingStep>('choice');
  const [dealershipName, setDealershipName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState('');
  const [copied, setCopied] = useState(false);

  const navigate = useNavigate();
  const { createDealership, joinDealership } = useAuth();
  const { toast } = useToast();

  const handleCreateDealership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealershipName.trim()) return;

    setLoading(true);
    try {
      const { error, dealership } = await createDealership(dealershipName);
      if (error) {
        toast({
          title: 'Failed to create dealership',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        setCreatedCode(dealership.invite_code);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoinDealership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    setLoading(true);
    try {
      const { error } = await joinDealership(inviteCode.trim().toLowerCase());
      if (error) {
        toast({
          title: 'Failed to join dealership',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Welcome!',
          description: 'You have successfully joined the dealership.',
        });
        navigate('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const copyInviteCode = () => {
    navigator.clipboard.writeText(createdCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <WaterBackground />

      {step === 'choice' && (
        <div className="w-full max-w-2xl animate-fade-in">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Set Up Your Account
            </h1>
            <p className="text-muted-foreground">
              Choose how you'd like to get started
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card
              className="cursor-pointer hover:shadow-water transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/50"
              onClick={() => setStep('create')}
            >
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Building2 className="w-7 h-7 text-primary" />
                </div>
                <CardTitle className="text-xl">Create a Dealership</CardTitle>
                <CardDescription>
                  Start a new dealership and invite your team
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button variant="water" className="w-full">
                  Get Started <ArrowRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-water transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/50"
              onClick={() => setStep('join')}
            >
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 w-14 h-14 bg-accent/10 rounded-xl flex items-center justify-center">
                  <Users className="w-7 h-7 text-accent" />
                </div>
                <CardTitle className="text-xl">Join a Dealership</CardTitle>
                <CardDescription>
                  Enter an invite code to join an existing team
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button variant="water-outline" className="w-full">
                  Join Team <ArrowRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {step === 'create' && !createdCode && (
        <Card className="w-full max-w-md shadow-water border-0 animate-scale-in">
          <CardHeader>
            <button
              onClick={() => setStep('choice')}
              className="text-muted-foreground hover:text-foreground text-sm mb-2"
            >
              ← Back
            </button>
            <CardTitle className="text-2xl">Create Your Dealership</CardTitle>
            <CardDescription>
              Give your dealership a name to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateDealership} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="font-medium">
                  Dealership Name
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="e.g., Crystal Clear Water Solutions"
                  value={dealershipName}
                  onChange={(e) => setDealershipName(e.target.value)}
                  className="h-11"
                />
              </div>
              <Button
                type="submit"
                variant="water"
                size="lg"
                className="w-full"
                disabled={loading || !dealershipName.trim()}
              >
                {loading ? 'Creating...' : 'Create Dealership'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {step === 'create' && createdCode && (
        <Card className="w-full max-w-md shadow-water border-0 animate-scale-in">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-accent" />
            </div>
            <CardTitle className="text-2xl">Dealership Created!</CardTitle>
            <CardDescription>
              Share this invite code with your team members
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted rounded-xl p-4 flex items-center justify-between">
              <code className="text-2xl font-mono font-bold tracking-wider text-foreground">
                {createdCode.toUpperCase()}
              </code>
              <Button
                variant="ghost"
                size="icon"
                onClick={copyInviteCode}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-accent" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </Button>
            </div>
            <Button
              variant="water"
              size="lg"
              className="w-full"
              onClick={() => navigate('/')}
            >
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'join' && (
        <Card className="w-full max-w-md shadow-water border-0 animate-scale-in">
          <CardHeader>
            <button
              onClick={() => setStep('choice')}
              className="text-muted-foreground hover:text-foreground text-sm mb-2"
            >
              ← Back
            </button>
            <CardTitle className="text-2xl">Join a Dealership</CardTitle>
            <CardDescription>
              Enter the invite code from your admin
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoinDealership} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code" className="font-medium">
                  Invite Code
                </Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="e.g., ABC12345"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  className="h-11 text-center font-mono text-lg tracking-wider uppercase"
                  maxLength={8}
                />
              </div>
              <Button
                type="submit"
                variant="water"
                size="lg"
                className="w-full"
                disabled={loading || inviteCode.length < 8}
              >
                {loading ? 'Joining...' : 'Join Dealership'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
