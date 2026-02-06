import { useState, useEffect } from 'react';
import { Camera, Upload, Trash2, Loader2, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { WizardState } from '@/hooks/useProposalWizard';

interface Photo {
  id: string;
  file_path: string;
  file_name: string;
  uploaded_by: string;
}

interface Props {
  state: WizardState;
  update: (partial: Partial<WizardState>) => void;
}

export function InstallDetailsStep({ state, update }: Props) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [savingDate, setSavingDate] = useState(false);

  useEffect(() => {
    if (state.proposalId) {
      fetchPhotos();
      fetchInstallDate();
    }
  }, [state.proposalId]);

  const fetchInstallDate = async () => {
    if (!state.proposalId) return;
    const { data } = await supabase
      .from('proposals')
      .select('install_date')
      .eq('id', state.proposalId)
      .single();
    if (data?.install_date) {
      update({ installDate: data.install_date });
    }
  };

  const fetchPhotos = async () => {
    setLoadingPhotos(true);
    const { data } = await supabase
      .from('installation_photos')
      .select('id, file_path, file_name, uploaded_by')
      .eq('proposal_id', state.proposalId!)
      .order('created_at', { ascending: false });
    if (data) setPhotos(data);
    setLoadingPhotos(false);
  };

  const handleDateChange = async (date: string) => {
    update({ installDate: date });
    if (!state.proposalId) return;
    setSavingDate(true);
    const { error } = await supabase
      .from('proposals')
      .update({ install_date: date || null })
      .eq('id', state.proposalId);
    if (error) {
      toast({ title: 'Error', description: 'Failed to save install date.', variant: 'destructive' });
    } else {
      toast({ title: 'Install date saved' });
    }
    setSavingDate(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !profile?.dealership_id || !state.proposalId) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}.${ext}`;
      const filePath = `${profile.dealership_id}/${state.proposalId}/${fileName}`;

      const { error: uploadErr } = await supabase.storage.from('installation-photos').upload(filePath, file);
      if (uploadErr) throw uploadErr;

      const { error: dbErr } = await supabase.from('installation_photos').insert({
        proposal_id: state.proposalId,
        dealership_id: profile.dealership_id,
        file_path: filePath,
        file_name: file.name,
        uploaded_by: user.id,
      });
      if (dbErr) throw dbErr;

      toast({ title: 'Photo uploaded' });
      fetchPhotos();
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (photo: Photo) => {
    await supabase.storage.from('installation-photos').remove([photo.file_path]);
    await supabase.from('installation_photos').delete().eq('id', photo.id);
    toast({ title: 'Photo deleted' });
    fetchPhotos();
  };

  const getPhotoUrl = (filePath: string) => {
    const { data } = supabase.storage.from('installation-photos').getPublicUrl(filePath);
    return data.publicUrl;
  };

  if (!state.proposalId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Save the proposal first to add install details.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Install Date */}
      <div className="space-y-2">
        <Label htmlFor="installDate" className="font-medium flex items-center gap-2">
          <CalendarDays className="w-4 h-4" /> Install Date
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="installDate"
            type="date"
            value={state.installDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="h-12 max-w-xs"
          />
          {savingDate && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* Photos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="font-medium flex items-center gap-2">
            <Camera className="w-4 h-4" /> Site Photos
          </Label>
          <label className="cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
            <Button variant="outline" size="sm" asChild>
              <span>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? 'Uploading...' : 'Upload Photo'}
              </span>
            </Button>
          </label>
        </div>

        {loadingPhotos ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
            <Camera className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No photos yet</p>
            <p className="text-xs text-muted-foreground">Upload photos of where the system will be installed</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((photo) => (
              <div key={photo.id} className="relative group rounded-lg overflow-hidden border">
                <img
                  src={getPhotoUrl(photo.file_path)}
                  alt={photo.file_name}
                  className="w-full h-32 object-cover"
                />
                {photo.uploaded_by === user?.id && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDelete(photo)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
                <p className="text-xs truncate px-2 py-1 bg-card">{photo.file_name}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
