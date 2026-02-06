import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, User, Droplets, Receipt, Camera, Upload, Trash2, ExternalLink, MapPin, Home, FileText, Droplet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ContractsTab } from '@/components/proposal/ContractsTab';
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

interface InstallationPhoto {
  id: string;
  file_path: string;
  file_name: string;
  created_at: string;
  uploaded_by: string;
}

interface Invoice {
  id: string;
  amount_cents: number;
  status: string;
  stripe_payment_link: string | null;
  created_at: string;
}

export default function ProposalProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [photos, setPhotos] = useState<InstallationPhoto[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchProposal();
      fetchPhotos();
      fetchInvoices();
    }
  }, [id]);

  const fetchProposal = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', id!)
      .single();

    if (error || !data) {
      toast({ title: 'Error', description: 'Proposal not found.', variant: 'destructive' });
      navigate('/');
    } else {
      setProposal(data);
    }
    setLoading(false);
  };

  const fetchPhotos = async () => {
    setLoadingPhotos(true);
    const { data } = await supabase
      .from('installation_photos')
      .select('*')
      .eq('proposal_id', id!)
      .order('created_at', { ascending: false });
    if (data) setPhotos(data);
    setLoadingPhotos(false);
  };

  const fetchInvoices = async () => {
    setLoadingInvoices(true);
    const { data } = await supabase
      .from('invoices')
      .select('id, amount_cents, status, stripe_payment_link, created_at')
      .eq('proposal_id', id!)
      .order('created_at', { ascending: false });
    if (data) setInvoices(data);
    setLoadingInvoices(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !profile?.dealership_id || !proposal) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${profile.dealership_id}/${proposal.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('installation-photos')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('installation_photos')
        .insert({
          proposal_id: proposal.id,
          dealership_id: profile.dealership_id,
          file_path: filePath,
          file_name: file.name,
          uploaded_by: user.id,
        });
      if (dbError) throw dbError;

      toast({ title: 'Photo uploaded' });
      fetchPhotos();
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (photo: InstallationPhoto) => {
    try {
      await supabase.storage.from('installation-photos').remove([photo.file_path]);
      await supabase.from('installation_photos').delete().eq('id', photo.id);
      toast({ title: 'Photo deleted' });
      fetchPhotos();
    } catch {
      toast({ title: 'Failed to delete photo', variant: 'destructive' });
    }
  };

  const getPhotoUrl = (filePath: string) => {
    const { data } = supabase.storage.from('installation-photos').getPublicUrl(filePath);
    return data.publicUrl;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading customer profile..." />
      </div>
    );
  }

  if (!proposal) return null;

  const hasWaterTestData = proposal.hardness !== null || proposal.iron !== null ||
    proposal.tds !== null || proposal.ph !== null || proposal.chlorine !== null;

  const hasHouseholdData = proposal.home_age || proposal.household_size || proposal.water_source;

  const appliances = [
    proposal.has_dishwasher && 'Dishwasher',
    proposal.has_dryer && 'Dryer',
    proposal.has_water_heater && 'Water Heater',
    proposal.has_ice_maker && 'Ice Maker',
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-10 h-10 gradient-water rounded-xl flex items-center justify-center shadow-sm">
              <Droplet className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-foreground">{proposal.customer_name}</h1>
              <p className="text-xs text-muted-foreground">{proposal.address}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {proposal.presentation_url && (
              <Button variant="outline" size="sm" onClick={() => window.open(proposal.presentation_url!, '_blank')}>
                <ExternalLink className="w-4 h-4" />
                View Presentation
              </Button>
            )}
            <Button variant="water" size="sm" onClick={() => setInvoiceDialogOpen(true)}>
              <Receipt className="w-4 h-4" />
              Invoice
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="border-0 shadow-soft">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground font-medium">System</p>
              <p className="text-lg font-bold text-foreground">{proposal.recommended_system}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-soft">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground font-medium">Created</p>
              <p className="text-lg font-bold text-foreground">{format(new Date(proposal.created_at), 'MMM d, yyyy')}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-soft">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground font-medium">Invoices</p>
              <p className="text-lg font-bold text-foreground">{invoices.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabbed content */}
        <Card className="border-0 shadow-soft">
          <CardContent className="pt-6">
            <Tabs defaultValue="customer" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="customer" className="text-xs sm:text-sm">
                  <User className="w-4 h-4 mr-1 hidden sm:inline" />
                  Customer
                </TabsTrigger>
                <TabsTrigger value="water" className="text-xs sm:text-sm">
                  <Droplets className="w-4 h-4 mr-1 hidden sm:inline" />
                  Water Test
                </TabsTrigger>
                <TabsTrigger value="contracts" className="text-xs sm:text-sm">
                  <FileText className="w-4 h-4 mr-1 hidden sm:inline" />
                  Contracts
                </TabsTrigger>
                <TabsTrigger value="invoices" className="text-xs sm:text-sm">
                  <Receipt className="w-4 h-4 mr-1 hidden sm:inline" />
                  Invoices
                </TabsTrigger>
                <TabsTrigger value="photos" className="text-xs sm:text-sm">
                  <Camera className="w-4 h-4 mr-1 hidden sm:inline" />
                  Photos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="customer" className="mt-6 space-y-6">
                <div className="space-y-2">
                  <h5 className="font-medium text-sm flex items-center gap-2">
                    <User className="w-4 h-4" /> Contact Information
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name:</span>
                      <p className="font-medium">{proposal.customer_name}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <p className="font-medium">{proposal.customer_email || '—'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Phone:</span>
                      <p className="font-medium">{proposal.customer_phone || '—'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h5 className="font-medium text-sm flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Service Address
                  </h5>
                  <p className="text-sm">{proposal.address}</p>
                </div>

                {hasHouseholdData && (
                  <div className="space-y-2">
                    <h5 className="font-medium text-sm flex items-center gap-2">
                      <Home className="w-4 h-4" /> Household Details
                    </h5>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      {proposal.home_age && (
                        <div><span className="text-muted-foreground">Home Age:</span><p className="font-medium">{proposal.home_age}</p></div>
                      )}
                      {proposal.household_size && (
                        <div><span className="text-muted-foreground">Household:</span><p className="font-medium">{proposal.household_size}</p></div>
                      )}
                      {proposal.water_source && (
                        <div><span className="text-muted-foreground">Water Source:</span><p className="font-medium">{proposal.water_source}</p></div>
                      )}
                      {proposal.num_bathrooms && (
                        <div><span className="text-muted-foreground">Bathrooms:</span><p className="font-medium">{proposal.num_bathrooms}</p></div>
                      )}
                    </div>
                    {appliances.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {appliances.map((app) => (
                          <Badge key={app} variant="secondary">{app}</Badge>
                        ))}
                      </div>
                    )}
                    {proposal.water_concerns && (
                      <div className="mt-2">
                        <span className="text-muted-foreground text-sm">Concerns:</span>
                        <p className="text-sm">{proposal.water_concerns}</p>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="water" className="mt-6">
                {hasWaterTestData ? (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    {proposal.hardness !== null && (
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <p className="text-2xl font-bold text-primary">{proposal.hardness}</p>
                        <p className="text-xs text-muted-foreground">Hardness (gpg)</p>
                      </div>
                    )}
                    {proposal.iron !== null && (
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <p className="text-2xl font-bold text-primary">{proposal.iron}</p>
                        <p className="text-xs text-muted-foreground">Iron (ppm)</p>
                      </div>
                    )}
                    {proposal.tds !== null && (
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <p className="text-2xl font-bold text-primary">{proposal.tds}</p>
                        <p className="text-xs text-muted-foreground">TDS (ppm)</p>
                      </div>
                    )}
                    {proposal.ph !== null && (
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <p className="text-2xl font-bold text-primary">{proposal.ph}</p>
                        <p className="text-xs text-muted-foreground">pH Level</p>
                      </div>
                    )}
                    {proposal.chlorine !== null && (
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <p className="text-2xl font-bold text-primary">{proposal.chlorine}</p>
                        <p className="text-xs text-muted-foreground">Chlorine (ppm)</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No water test data recorded</p>
                )}
              </TabsContent>

              <TabsContent value="contracts" className="mt-6">
                <ContractsTab proposalId={proposal.id} customerName={proposal.customer_name} />
              </TabsContent>

              <TabsContent value="invoices" className="mt-6">
                {loadingInvoices ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Loading invoices...</p>
                ) : invoices.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground mb-4">No invoices created yet</p>
                    <Button variant="outline" size="sm" onClick={() => setInvoiceDialogOpen(true)}>
                      <Receipt className="w-4 h-4 mr-2" />
                      Create Invoice
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {invoices.map((invoice) => (
                      <div key={invoice.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium">${(invoice.amount_cents / 100).toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(invoice.created_at), 'MMM d, yyyy')}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>
                            {invoice.status}
                          </Badge>
                          {invoice.stripe_payment_link && (
                            <Button variant="ghost" size="sm" onClick={() => window.open(invoice.stripe_payment_link!, '_blank')}>
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="photos" className="mt-6">
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
                      <Button variant="outline" size="sm" disabled={uploading} asChild>
                        <span>
                          <Upload className="w-4 h-4 mr-2" />
                          {uploading ? 'Uploading...' : 'Upload Photo'}
                        </span>
                      </Button>
                    </label>
                  </div>

                  {loadingPhotos ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Loading photos...</p>
                  ) : photos.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No installation photos yet</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {photos.map((photo) => (
                        <div key={photo.id} className="relative group">
                          <img
                            src={getPhotoUrl(photo.file_path)}
                            alt={photo.file_name}
                            className="w-full aspect-square object-cover rounded-lg"
                          />
                          {photo.uploaded_by === user?.id && (
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                              onClick={() => handleDeletePhoto(photo)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>

      <CreateInvoiceDialog
        proposal={proposal}
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
      />
    </div>
  );
}
