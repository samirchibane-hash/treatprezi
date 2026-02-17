import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, User, Droplets, Receipt, Camera, Upload, Trash2,
  ExternalLink, MapPin, Home, FileText, Droplet, ShoppingCart, Check, Image,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

interface ProposalProduct {
  product_id: string;
  products: {
    name: string;
    description: string | null;
    price_cents: number;
    image_url: string | null;
  };
}

// ── Section wrapper ──────────────────────────────────────────────────────────
function Section({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: React.ElementType;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl gradient-water flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-primary-foreground" />
          </div>
          <h2 className="text-[15px] font-semibold text-foreground tracking-tight">{title}</h2>
        </div>
        {action}
      </div>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

// ── Info row ─────────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium mb-0.5">{label}</p>
      <p className="text-[14px] text-foreground font-medium">{value || '—'}</p>
    </div>
  );
}

// ── Water metric tile ─────────────────────────────────────────────────────────
function WaterTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-4 bg-muted/40 rounded-2xl gap-1">
      <p className="text-3xl font-bold text-primary tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground text-center leading-tight">{label}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProposalProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [photos, setPhotos] = useState<InstallationPhoto[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [proposalProducts, setProposalProducts] = useState<ProposalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchProposal();
      fetchPhotos();
      fetchInvoices();
      fetchProposalProducts();
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
    const { data } = await supabase
      .from('installation_photos')
      .select('*')
      .eq('proposal_id', id!)
      .order('created_at', { ascending: false });
    if (data) setPhotos(data);
  };

  const fetchInvoices = async () => {
    const { data } = await supabase
      .from('invoices')
      .select('id, amount_cents, status, stripe_payment_link, created_at')
      .eq('proposal_id', id!)
      .order('created_at', { ascending: false });
    if (data) setInvoices(data);
  };

  const fetchProposalProducts = async () => {
    const { data } = await supabase
      .from('proposal_products' as any)
      .select('product_id, products(name, description, price_cents, image_url)')
      .eq('proposal_id', id!);
    if (data) setProposalProducts(data as unknown as ProposalProduct[]);
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

  const hasWaterTestData =
    proposal.hardness !== null || proposal.iron !== null ||
    proposal.tds !== null || proposal.ph !== null || proposal.chlorine !== null;

  const appliances = [
    proposal.has_dishwasher && 'Dishwasher',
    proposal.has_dryer && 'Dryer',
    proposal.has_water_heater && 'Water Heater',
    proposal.has_ice_maker && 'Ice Maker',
  ].filter(Boolean) as string[];

  return (
    <div className="min-h-screen bg-background">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-xl backdrop-saturate-150">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="w-8 h-8 gradient-water rounded-xl flex items-center justify-center">
              <Droplet className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <p className="text-[15px] font-semibold text-foreground tracking-tight leading-none">{proposal.customer_name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[200px]">{proposal.address}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {proposal.presentation_url && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-xl text-[13px] gap-1.5"
                onClick={() => window.open(proposal.presentation_url!, '_blank')}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Presentation
              </Button>
            )}
            <Button
              variant="water"
              size="sm"
              className="h-8 rounded-xl text-[13px] gap-1.5"
              onClick={() => setInvoiceDialogOpen(true)}
            >
              <Receipt className="w-3.5 h-3.5" />
              Invoice
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero stat bar ── */}
      <div className="border-b border-border/40 bg-card/60">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium">System</p>
            <p className="text-[14px] font-semibold text-foreground mt-0.5">{proposal.recommended_system}</p>
          </div>
          <div className="w-px h-8 bg-border/60" />
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium">Created</p>
            <p className="text-[14px] font-semibold text-foreground mt-0.5">
              {format(new Date(proposal.created_at), 'MMM d, yyyy')}
            </p>
          </div>
          <div className="w-px h-8 bg-border/60" />
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium">Invoices</p>
            <p className="text-[14px] font-semibold text-foreground mt-0.5">{invoices.length}</p>
          </div>
        </div>
      </div>

      {/* ── Stacked sections ── */}
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-5">

        {/* 1 · Customer Details */}
        <Section icon={User} title="Customer Details">
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
              <InfoRow label="Name" value={proposal.customer_name} />
              <InfoRow label="Email" value={proposal.customer_email} />
              <InfoRow label="Phone" value={proposal.customer_phone} />
            </div>

            <div className="pt-4 border-t border-border/40">
              <div className="flex items-center gap-1.5 mb-2">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium">Address</p>
              </div>
              <p className="text-[14px] text-foreground font-medium">{proposal.address}</p>
            </div>

            {(proposal.home_age || proposal.household_size || proposal.water_source || proposal.num_bathrooms) && (
              <div className="pt-4 border-t border-border/40">
                <div className="flex items-center gap-1.5 mb-3">
                  <Home className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium">Household</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {proposal.home_age && <InfoRow label="Home Age" value={proposal.home_age} />}
                  {proposal.household_size && <InfoRow label="Household Size" value={proposal.household_size} />}
                  {proposal.water_source && <InfoRow label="Water Source" value={proposal.water_source} />}
                  {proposal.num_bathrooms && <InfoRow label="Bathrooms" value={proposal.num_bathrooms} />}
                </div>
                {appliances.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {appliances.map((app) => (
                      <Badge key={app} variant="secondary" className="rounded-lg text-[12px]">{app}</Badge>
                    ))}
                  </div>
                )}
                {proposal.water_concerns && (
                  <div className="mt-4">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium mb-1">Water Concerns</p>
                    <p className="text-[14px] text-foreground">{proposal.water_concerns}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>

        {/* 2 · Water Test */}
        <Section icon={Droplets} title="Water Test">
          {hasWaterTestData ? (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {proposal.hardness !== null && <WaterTile value={proposal.hardness} label="Hardness (gpg)" />}
              {proposal.iron !== null && <WaterTile value={proposal.iron} label="Iron (ppm)" />}
              {proposal.tds !== null && <WaterTile value={proposal.tds} label="TDS (ppm)" />}
              {proposal.ph !== null && <WaterTile value={proposal.ph} label="pH Level" />}
              {proposal.chlorine !== null && <WaterTile value={proposal.chlorine} label="Chlorine (ppm)" />}
            </div>
          ) : (
            <div className="py-6 text-center">
              <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                <Droplets className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-[13px] text-muted-foreground">No water test data recorded</p>
            </div>
          )}
        </Section>

        {/* 3 · System Buildout */}
        <Section icon={ShoppingCart} title="System Buildout">
          {proposalProducts.length === 0 ? (
            <div className="py-6 text-center">
              <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                <ShoppingCart className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-[13px] text-muted-foreground">No products selected yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {proposalProducts.map((pp) => {
                const p = pp.products;
                return (
                  <div key={pp.product_id} className="flex items-center gap-4 p-3.5 bg-muted/40 rounded-xl">
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <Image className="w-5 h-5 text-muted-foreground/40" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-foreground truncate">{p.name}</p>
                      {p.description && (
                        <p className="text-[12px] text-muted-foreground truncate mt-0.5">{p.description}</p>
                      )}
                    </div>
                    <p className="text-[14px] font-bold text-primary whitespace-nowrap">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p.price_cents / 100)}
                    </p>
                  </div>
                );
              })}
              <div className="flex justify-between items-center pt-2 border-t border-border/40">
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-primary" />
                  <p className="text-[13px] text-muted-foreground">
                    {proposalProducts.length} product{proposalProducts.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <p className="text-[16px] font-bold text-primary">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                    proposalProducts.reduce((sum, pp) => sum + pp.products.price_cents, 0) / 100
                  )}
                </p>
              </div>
            </div>
          )}
        </Section>

        {/* 4 · Contracts */}
        <Section icon={FileText} title="Contracts">
          <ContractsTab proposalId={proposal.id} customerName={proposal.customer_name} />
        </Section>

        {/* 5 · Invoices */}
        <Section
          icon={Receipt}
          title="Invoices"
          action={
            <Button
              variant="outline"
              size="sm"
              className="h-7 rounded-xl text-[12px] gap-1.5"
              onClick={() => setInvoiceDialogOpen(true)}
            >
              <Receipt className="w-3 h-3" />
              New Invoice
            </Button>
          }
        >
          {invoices.length === 0 ? (
            <div className="py-6 text-center">
              <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                <Receipt className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-[13px] text-muted-foreground mb-3">No invoices created yet</p>
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setInvoiceDialogOpen(true)}>
                Create First Invoice
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-3.5 bg-muted/40 rounded-xl"
                >
                  <div>
                    <p className="text-[15px] font-semibold text-foreground tabular-nums">
                      ${(invoice.amount_cents / 100).toFixed(2)}
                    </p>
                    <p className="text-[12px] text-muted-foreground mt-0.5">
                      {format(new Date(invoice.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={invoice.status === 'paid' ? 'default' : 'secondary'}
                      className="rounded-lg capitalize text-[12px]"
                    >
                      {invoice.status}
                    </Badge>
                    {invoice.stripe_payment_link && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-xl"
                        onClick={() => window.open(invoice.stripe_payment_link!, '_blank')}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 6 · Installation & Photos */}
        <Section
          icon={Camera}
          title="Installation & Photos"
          action={
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
                disabled={uploading}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-7 rounded-xl text-[12px] gap-1.5 pointer-events-none"
                disabled={uploading}
                asChild
              >
                <span>
                  <Upload className="w-3 h-3" />
                  {uploading ? 'Uploading…' : 'Upload'}
                </span>
              </Button>
            </label>
          }
        >
          {photos.length === 0 ? (
            <div className="py-6 text-center">
              <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                <Camera className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-[13px] text-muted-foreground">No installation photos yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {photos.map((photo) => (
                <div key={photo.id} className="relative group rounded-xl overflow-hidden aspect-square">
                  <img
                    src={getPhotoUrl(photo.file_path)}
                    alt={photo.file_name}
                    className="w-full h-full object-cover"
                  />
                  {photo.uploaded_by === user?.id && (
                    <button
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      onClick={() => handleDeletePhoto(photo)}
                    >
                      <div className="w-8 h-8 rounded-xl bg-destructive flex items-center justify-center">
                        <Trash2 className="w-4 h-4 text-destructive-foreground" />
                      </div>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

      </main>

      <CreateInvoiceDialog
        proposal={proposal}
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
      />
    </div>
  );
}
