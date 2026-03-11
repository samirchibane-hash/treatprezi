import { useState, useEffect } from 'react';
import { Landmark, Plus, Pencil, Trash2, Loader2, Upload, X, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const MONTH_OPTIONS = [6, 12, 18, 24, 36, 48, 60, 72, 84, 120, 144, 180];

interface FinancingPartner {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  application_url: string | null;
  installment_months: number[];
  is_active: boolean;
}

export function FinancingPartnersCard() {
  const [partners, setPartners] = useState<FinancingPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<FinancingPartner | null>(null);
  const [deletingPartner, setDeletingPartner] = useState<FinancingPartner | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logo_url: null as string | null,
    application_url: '',
    installment_months: [] as number[],
    is_active: true,
  });
  const { toast } = useToast();
  const { profile } = useAuth();

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchPartners = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('financing_partners')
      .select('*')
      .order('name');
    if (!error && data) setPartners(data as FinancingPartner[]);
    setLoading(false);
  };

  const openAddDialog = () => {
    setEditingPartner(null);
    setFormData({ name: '', description: '', logo_url: null, application_url: '', installment_months: [], is_active: true });
    setDialogOpen(true);
  };

  const openEditDialog = (partner: FinancingPartner) => {
    setEditingPartner(partner);
    setFormData({
      name: partner.name,
      description: partner.description || '',
      logo_url: partner.logo_url,
      application_url: partner.application_url || '',
      installment_months: partner.installment_months || [],
      is_active: partner.is_active,
    });
    setDialogOpen(true);
  };

  const toggleMonth = (month: number) => {
    setFormData((prev) => ({
      ...prev,
      installment_months: prev.installment_months.includes(month)
        ? prev.installment_months.filter((m) => m !== month)
        : [...prev.installment_months, month].sort((a, b) => a - b),
    }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.dealership_id) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${profile.dealership_id}/financing/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('product-images').upload(fileName, file);
      if (uploadErr) throw uploadErr;
      const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
      setFormData((prev) => ({ ...prev, logo_url: data.publicUrl }));
      toast({ title: 'Logo uploaded' });
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Name required', description: 'Please enter a partner name.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (editingPartner) {
        const { error } = await supabase
          .from('financing_partners')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            logo_url: formData.logo_url || null,
            application_url: formData.application_url.trim() || null,
            installment_months: formData.installment_months,
            is_active: formData.is_active,
          } as any)
          .eq('id', editingPartner.id);
        if (error) throw error;
        toast({ title: 'Partner updated' });
      } else {
        if (!profile?.dealership_id) throw new Error('No dealership');
        const { error } = await supabase.from('financing_partners').insert({
          dealership_id: profile.dealership_id,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          logo_url: formData.logo_url || null,
          application_url: formData.application_url.trim() || null,
          installment_months: formData.installment_months,
          is_active: formData.is_active,
        } as any);
        if (error) throw error;
        toast({ title: 'Partner added' });
      }
      setDialogOpen(false);
      fetchPartners();
    } catch (error) {
      console.error('Error saving partner:', error);
      toast({ title: 'Error', description: 'Failed to save partner', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingPartner) return;
    try {
      const { error } = await supabase.from('financing_partners').delete().eq('id', deletingPartner.id);
      if (error) throw error;
      toast({ title: 'Partner removed' });
      setDeleteDialogOpen(false);
      fetchPartners();
    } catch {
      toast({ title: 'Error', description: 'Failed to remove partner', variant: 'destructive' });
    }
  };

  return (
    <>
      <Card className="border-0 shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-primary" />
                Financing Partners
              </CardTitle>
              <CardDescription>
                Configure lenders your team can offer customers during the proposal process
              </CardDescription>
            </div>
            <Button variant="water" size="sm" onClick={openAddDialog}>
              <Plus className="w-4 h-4" />
              Add Partner
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : partners.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Landmark className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No financing partners yet</p>
              <p className="text-sm">Add lenders your team can offer during proposals</p>
            </div>
          ) : (
            <div className="space-y-3">
              {partners.map((partner) => (
                <div
                  key={partner.id}
                  className={`flex items-start gap-4 p-4 rounded-lg border bg-card transition-opacity ${!partner.is_active ? 'opacity-50' : ''}`}
                >
                  {/* Logo */}
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center border">
                    {partner.logo_url ? (
                      <img src={partner.logo_url} alt={partner.name} className="w-full h-full object-contain p-1" />
                    ) : (
                      <Landmark className="w-6 h-6 text-muted-foreground/40" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{partner.name}</span>
                      {!partner.is_active && (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">Inactive</span>
                      )}
                    </div>
                    {partner.description && (
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-1">{partner.description}</p>
                    )}
                    {partner.application_url && (
                      <a
                        href={partner.application_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mb-2"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Application Link
                      </a>
                    )}
                    {partner.installment_months && partner.installment_months.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {partner.installment_months.map((m) => (
                          <span key={m} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                            {m} mo
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(partner)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => { setDeletingPartner(partner); setDeleteDialogOpen(true); }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPartner ? 'Edit Financing Partner' : 'Add Financing Partner'}</DialogTitle>
            <DialogDescription>
              {editingPartner ? 'Update the lender details below.' : 'Add a lender your team can offer during proposals.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            {/* Logo Upload */}
            <div className="space-y-2">
              <Label>Partner Logo</Label>
              {formData.logo_url ? (
                <div className="relative w-full h-32 rounded-lg overflow-hidden border bg-muted flex items-center justify-center">
                  <img src={formData.logo_url} alt="Logo" className="max-h-full max-w-full object-contain p-4" />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 w-7 h-7"
                    onClick={() => setFormData((prev) => ({ ...prev, logo_url: null }))}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors">
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
                  {uploading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                      <span className="text-sm text-muted-foreground">Click to upload logo</span>
                    </>
                  )}
                </label>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="partner-name">Partner Name</Label>
              <Input
                id="partner-name"
                placeholder="e.g., GreenSky, Mosaic, EnerBank"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="partner-desc">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                id="partner-desc"
                placeholder="e.g., Specializes in home improvement financing with competitive rates"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="partner-url">Application URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="partner-url"
                type="url"
                placeholder="https://apply.lender.com/your-dealer"
                value={formData.application_url}
                onChange={(e) => setFormData({ ...formData, application_url: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Link to the financing approval application for this partner</p>
            </div>

            {/* Installment Months */}
            <div className="space-y-3">
              <Label>Financing Terms (months)</Label>
              <p className="text-xs text-muted-foreground -mt-1">Select the installment lengths this partner offers</p>
              <div className="flex flex-wrap gap-2">
                {MONTH_OPTIONS.map((m) => {
                  const selected = formData.installment_months.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleMonth(m)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-colors ${
                        selected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
                      }`}
                    >
                      {m} mo
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="partner-active">Active</Label>
              <Switch
                id="partner-active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="water" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : editingPartner ? 'Save Changes' : 'Add Partner'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Partner?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{deletingPartner?.name}" from your financing partners.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
