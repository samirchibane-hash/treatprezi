import { useState, useEffect } from 'react';
import { FileText, Download, Loader2, Plus, Trash2, Copy, Check, Send, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  signing_token: string | null;
  signing_expires_at: string | null;
  signer_name: string | null;
  created_at: string;
  created_by: string;
  template_id: string | null;
}

interface Template {
  id: string;
  name: string;
  is_default: boolean;
}

interface ContractsTabProps {
  proposalId: string;
  customerName: string;
}

export function ContractsTab({ proposalId, customerName }: ContractsTabProps) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('default');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchContracts();
    fetchTemplates();
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

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from('contract_templates')
      .select('id, name, is_default')
      .order('is_default', { ascending: false })
      .order('name');

    if (data) {
      setTemplates(data);
      const defaultTpl = data.find(t => t.is_default);
      if (defaultTpl) setSelectedTemplateId(defaultTpl.id);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const body: Record<string, string> = { proposalId };
      if (selectedTemplateId !== 'default') {
        body.templateId = selectedTemplateId;
      }

      const { data, error } = await supabase.functions.invoke('generate-contract', {
        body,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Contract generated!',
        description: `Contract for ${customerName} is ready.`,
      });

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
    } catch {
      toast({ title: 'Error', description: 'Failed to download contract', variant: 'destructive' });
    } finally {
      setDownloading(null);
    }
  };

  const handleCopySigningLink = async (contract: Contract) => {
    if (!contract.signing_token) {
      toast({ title: 'No signing link', description: 'This contract does not have a signing link.', variant: 'destructive' });
      return;
    }

    const signingUrl = `${window.location.origin}/sign?token=${contract.signing_token}`;
    await navigator.clipboard.writeText(signingUrl);
    setCopiedLink(contract.id);
    setTimeout(() => setCopiedLink(null), 2000);
    toast({ title: 'Copied!', description: 'Signing link copied to clipboard.' });
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

  const statusConfig = (status: string) => {
    switch (status) {
      case 'signed': return { variant: 'default' as const, label: 'Signed' };
      case 'sent': return { variant: 'secondary' as const, label: 'Sent' };
      case 'expired': return { variant: 'outline' as const, label: 'Expired' };
      default: return { variant: 'outline' as const, label: 'Draft' };
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2 justify-end">
        {templates.length > 0 && (
          <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default Template</SelectItem>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name} {t.is_default ? '(default)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating}>
          {generating ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
          ) : (
            <><Plus className="w-4 h-4" /> Generate Contract</>
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
          {contracts.map((contract) => {
            const sc = statusConfig(contract.status);
            return (
              <div key={contract.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{contract.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(contract.created_at), 'MMM d, yyyy h:mm a')}
                      {contract.signer_name && ` • Signed by ${contract.signer_name}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Badge variant={sc.variant}>{sc.label}</Badge>
                  {contract.signing_token && contract.status !== 'signed' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopySigningLink(contract)}
                      title="Copy signing link"
                    >
                      {copiedLink === contract.id ? <Check className="w-4 h-4" /> : <Link className="w-4 h-4" />}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(contract)}
                    disabled={downloading === contract.id}
                    title="Download"
                  >
                    {downloading === contract.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  </Button>
                  {contract.created_by === user?.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(contract)}
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
