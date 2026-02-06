import { useState, useEffect } from 'react';
import { FileText, Download, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

interface Contract {
  id: string;
  file_path: string;
  file_name: string;
  status: string;
  signed_at: string | null;
  created_at: string;
  created_by: string;
}

interface ContractsTabProps {
  proposalId: string;
  customerName: string;
}

export function ContractsTab({ proposalId, customerName }: ContractsTabProps) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchContracts();
  }, [proposalId]);

  const fetchContracts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setContracts(data);
    }
    setLoading(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-contract', {
        body: { proposalId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Contract generated!',
        description: `Contract for ${customerName} is ready to download.`,
      });

      // Open download immediately
      if (data?.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      }

      fetchContracts();
    } catch (error) {
      console.error('Error generating contract:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate contract',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (contract: Contract) => {
    setDownloading(contract.id);
    try {
      const { data, error } = await supabase.storage
        .from('contracts')
        .createSignedUrl(contract.file_path, 3600);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to download contract',
        variant: 'destructive',
      });
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async (contract: Contract) => {
    try {
      await supabase.storage.from('contracts').remove([contract.file_path]);
      await supabase.from('contracts').delete().eq('id', contract.id);
      toast({ title: 'Contract deleted' });
      fetchContracts();
    } catch {
      toast({ title: 'Failed to delete contract', variant: 'destructive' });
    }
  };

  const statusVariant = (status: string) => {
    switch (status) {
      case 'signed': return 'default' as const;
      case 'sent': return 'secondary' as const;
      default: return 'outline' as const;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Generate Contract
            </>
          )}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading contracts...</p>
      ) : contracts.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground mb-4">No contracts generated yet</p>
          <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating}>
            <FileText className="w-4 h-4 mr-2" />
            Generate First Contract
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {contracts.map((contract) => (
            <div key={contract.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{contract.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(contract.created_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant={statusVariant(contract.status)}>
                  {contract.status}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownload(contract)}
                  disabled={downloading === contract.id}
                >
                  {downloading === contract.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                </Button>
                {contract.created_by === user?.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(contract)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
