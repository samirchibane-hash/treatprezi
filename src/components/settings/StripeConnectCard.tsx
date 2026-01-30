import { useState, useEffect } from 'react';
import { CreditCard, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface StripeStatus {
  connected: boolean;
  onboarded: boolean;
  accountId?: string;
}

export function StripeConnectCard() {
  const { toast } = useToast();
  const [status, setStatus] = useState<StripeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const getInvokeErrorMessage = async (err: unknown): Promise<string> => {
    // supabase-js Functions errors often carry the underlying Response in `context`
    const anyErr = err as any;

    try {
      const ctx = anyErr?.context;
      if (ctx && typeof ctx === 'object' && typeof (ctx as Response).json === 'function') {
        const body = await (ctx as Response).json().catch(() => null);
        if (body?.error && typeof body.error === 'string') return body.error;
        if (body?.message && typeof body.message === 'string') return body.message;
      }
    } catch {
      // ignore
    }

    if (anyErr?.message && typeof anyErr.message === 'string') return anyErr.message;
    return 'Failed to start Stripe connection. Please try again.';
  };

  const checkStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect-status');
      if (error) throw error;
      setStatus(data);
    } catch (error) {
      console.error('Failed to check Stripe status:', error);
      toast({
        title: 'Error',
        description: 'Failed to check Stripe connection status.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleConnectStripe = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect-account', {
        body: { returnUrl: `${window.location.origin}/settings` },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Failed to connect Stripe:', error);

      const message = await getInvokeErrorMessage(error);
      const actionHint = message.toLowerCase().includes('temporarily restricted')
        ? ' Stripe needs you to confirm this activity in your Stripe account, then retry.'
        : '';

      toast({
        title: 'Error',
        description: `${message}${actionHint}`,
        variant: 'destructive',
      });
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-soft">
        <CardContent className="py-8">
          <LoadingSpinner message="Checking Stripe status..." />
        </CardContent>
      </Card>
    );
  }

  const isFullyConnected = status?.connected && status?.onboarded;
  const isPending = status?.connected && !status?.onboarded;

  return (
    <Card className="border-0 shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          Payment Processing
        </CardTitle>
        <CardDescription>
          Connect your Stripe account to receive payments from customers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Display */}
        <div className={`p-4 rounded-lg flex items-start gap-3 ${
          isFullyConnected 
            ? 'bg-green-500/10 border border-green-500/20' 
            : isPending 
              ? 'bg-yellow-500/10 border border-yellow-500/20'
              : 'bg-muted border border-border'
        }`}>
          {isFullyConnected ? (
            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
          ) : isPending ? (
            <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
          )}
          <div className="flex-1">
            <p className={`font-medium ${
              isFullyConnected 
                ? 'text-green-600 dark:text-green-400' 
                : isPending 
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-foreground'
            }`}>
              {isFullyConnected 
                ? 'Stripe Connected' 
                : isPending 
                  ? 'Onboarding Incomplete'
                  : 'Not Connected'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {isFullyConnected 
                ? 'Your Stripe account is fully set up and ready to receive payments.'
                : isPending 
                  ? 'Please complete your Stripe onboarding to start receiving payments.'
                  : 'Connect your Stripe account to enable payment processing for your dealership.'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          {!isFullyConnected && (
            <Button 
              variant="water" 
              onClick={handleConnectStripe}
              disabled={connecting}
              className="flex items-center gap-2"
            >
              {connecting ? (
                'Connecting...'
              ) : (
                <>
                  <ExternalLink className="w-4 h-4" />
                  {isPending ? 'Complete Setup' : 'Connect Stripe'}
                </>
              )}
            </Button>
          )}
          
          {isFullyConnected && (
            <Button 
              variant="outline" 
              onClick={handleConnectStripe}
              disabled={connecting}
              className="flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Manage Stripe Account
            </Button>
          )}

          <Button 
            variant="ghost" 
            onClick={checkStatus}
            disabled={loading}
          >
            Refresh Status
          </Button>
        </div>

        {/* Info Text */}
        <p className="text-xs text-muted-foreground">
          Payments are processed securely through Stripe. You'll receive funds directly to your connected bank account.
        </p>
      </CardContent>
    </Card>
  );
}
