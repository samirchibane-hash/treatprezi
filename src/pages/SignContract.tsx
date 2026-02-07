import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, CheckCircle2, AlertCircle, Loader2, Download, PenLine, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PdfViewer } from '@/components/pdf/PdfViewer';
import { SignaturePad } from '@/components/signature/SignaturePad';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ContractInfo {
  valid: boolean;
  contractId: string;
  fileName: string;
  pdfUrl: string;
  customerName: string;
  companyName: string;
  address: string;
  system: string;
  alreadySigned?: boolean;
  expired?: boolean;
  error?: string;
}

export default function SignContract() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [signatureMode, setSignatureMode] = useState<'draw' | 'type'>('draw');
  const { toast } = useToast();

  useEffect(() => {
    if (token) {
      verifyToken();
    } else {
      setLoading(false);
    }
  }, [token]);

  const verifyToken = async () => {
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-signing-token?token=${token}`;
      const response = await fetch(url, {
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      setContractInfo(result);

      if (result.customerName) {
        setSignerName(result.customerName);
      }
    } catch (error) {
      console.error('Error verifying token:', error);
      setContractInfo({ valid: false, error: 'Unable to verify signing link' } as ContractInfo);
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    if (!signerName.trim() || !token) return;

    setSigning(true);
    try {
      const body: Record<string, unknown> = { token, signerName: signerName.trim() };
      if (signatureImage) {
        body.signatureImage = signatureImage;
      }
      const { data, error } = await supabase.functions.invoke('sign-contract', {
        body,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSigned(true);
      toast({ title: 'Contract signed!', description: 'Thank you for signing the contract.' });
    } catch (error) {
      console.error('Signing error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to sign contract',
        variant: 'destructive',
      });
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md text-center border-0 shadow-lg">
          <CardContent className="pt-12 pb-12">
            <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Verifying signing link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!token || !contractInfo?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center border-0 shadow-lg">
          <CardContent className="pt-12 pb-12">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-bold mb-2">
              {contractInfo?.alreadySigned ? 'Already Signed' : contractInfo?.expired ? 'Link Expired' : 'Invalid Link'}
            </h2>
            <p className="text-muted-foreground">
              {contractInfo?.alreadySigned
                ? 'This contract has already been signed.'
                : contractInfo?.expired
                  ? 'This signing link has expired. Please contact your representative for a new link.'
                  : 'This signing link is invalid or has been revoked.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center border-0 shadow-lg">
          <CardContent className="pt-12 pb-12">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Contract Signed!</h2>
            <p className="text-muted-foreground mb-2">
              Thank you, {signerName}. Your signed contract has been recorded.
            </p>
            <p className="text-sm text-muted-foreground">
              A copy will be provided by {contractInfo.companyName}.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-0 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{contractInfo.companyName}</h1>
                <p className="text-sm text-muted-foreground">Contract for {contractInfo.customerName}</p>
              </div>
            </div>
            {contractInfo.address && (
              <p className="text-sm text-muted-foreground">Service Address: {contractInfo.address}</p>
            )}
          </CardContent>
        </Card>

        {/* PDF Viewer */}
        {contractInfo.pdfUrl && (
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-3 bg-muted/50 border-b">
                <span className="text-sm font-medium">Contract Document</span>
                <Button variant="ghost" size="sm" onClick={() => window.open(contractInfo.pdfUrl, '_blank')}>
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </Button>
              </div>
              <PdfViewer url={contractInfo.pdfUrl} />
            </CardContent>
          </Card>
        )}

        {/* Signing Form */}
        <Card className="border-0 shadow-lg">
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <PenLine className="w-5 h-5 text-primary" />
              Sign This Contract
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signer">Your Full Name</Label>
                <Input
                  id="signer"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Enter your full legal name"
                  className="text-lg h-12"
                />
              </div>

              <Tabs value={signatureMode} onValueChange={(v) => setSignatureMode(v as 'draw' | 'type')} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="draw" className="gap-2">
                    <PenLine className="w-4 h-4" /> Draw Signature
                  </TabsTrigger>
                  <TabsTrigger value="type" className="gap-2">
                    <Type className="w-4 h-4" /> Type to Sign
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="draw" className="mt-4">
                  <SignaturePad onSignatureChange={setSignatureImage} />
                  <p className="text-xs text-muted-foreground mt-2">
                    Use your finger or stylus to draw your signature above.
                  </p>
                </TabsContent>
                <TabsContent value="type" className="mt-4">
                  <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 bg-white p-6 text-center min-h-[120px] flex items-center justify-center">
                    {signerName.trim() ? (
                      <p className="text-3xl italic font-serif text-foreground select-none">{signerName}</p>
                    ) : (
                      <p className="text-muted-foreground/40 text-sm">Your name will appear here as your signature</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Your typed name will be used as your digital signature.
                  </p>
                </TabsContent>
              </Tabs>

              <p className="text-xs text-muted-foreground">
                By clicking "Sign Contract", you agree to the terms outlined in the document above.
              </p>

              <Button
                variant="water"
                size="lg"
                className="w-full"
                onClick={handleSign}
                disabled={signing || !signerName.trim() || (signatureMode === 'draw' && !signatureImage)}
              >
                {signing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Signing...</>
                ) : (
                  <><PenLine className="w-4 h-4" /> Sign Contract</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
