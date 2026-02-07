import { useState, useEffect } from 'react';
import { FileText, Plus, Trash2, Loader2, Edit, Eye, Star, StarOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface ContractTemplate {
  id: string;
  name: string;
  description: string | null;
  html_content: string;
  is_default: boolean;
  created_at: string;
}

const DEFAULT_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
<style>
  @page { size: letter; margin: 1in; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; line-height: 1.6; font-size: 11pt; }
  .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #0077b6; padding-bottom: 20px; }
  .header h1 { color: #0077b6; margin: 0; font-size: 24pt; }
  .header p { color: #666; margin: 5px 0 0; font-size: 10pt; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 30px; }
  .meta-box { background: #f8f9fa; border-radius: 8px; padding: 15px; width: 48%; }
  .meta-box h3 { margin: 0 0 8px; color: #0077b6; font-size: 10pt; text-transform: uppercase; letter-spacing: 1px; }
  .meta-box p { margin: 3px 0; font-size: 10pt; }
  h2 { color: #0077b6; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px; font-size: 14pt; margin-top: 30px; }
  table { width: 100%; border-collapse: collapse; margin: 15px 0; }
  th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e8e8e8; font-size: 10pt; }
  th { background: #f0f7ff; color: #0077b6; font-weight: 600; }
  .system-box { background: #f0f7ff; border: 2px solid #0077b6; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
  .system-box h3 { color: #0077b6; margin: 0 0 5px; font-size: 14pt; }
  .system-box p { margin: 0; color: #666; font-size: 10pt; }
  .signature-section { margin-top: 60px; page-break-inside: avoid; }
  .sig-line { display: flex; justify-content: space-between; margin-top: 50px; }
  .sig-block { width: 45%; }
  .sig-block .line { border-top: 1px solid #333; padding-top: 5px; margin-top: 40px; }
  .sig-block p { margin: 3px 0; font-size: 9pt; color: #666; }
  .terms { font-size: 8pt; color: #888; margin-top: 40px; padding-top: 15px; border-top: 1px solid #e0e0e0; }
  .date { font-size: 10pt; color: #666; text-align: right; margin-bottom: 20px; }
</style>
</head>
<body>
  <div class="header">
    <h1>{{company_name}}</h1>
    <p>{{company_address}} {{company_phone}}</p>
  </div>

  <p class="date">Date: {{date}}</p>

  <div class="meta">
    <div class="meta-box">
      <h3>Customer</h3>
      <p><strong>{{customer_name}}</strong></p>
      <p>{{customer_address}}</p>
      <p>{{customer_email}}</p>
      <p>{{customer_phone}}</p>
    </div>
    <div class="meta-box">
      <h3>Sales Representative</h3>
      <p><strong>{{rep_name}}</strong></p>
      <p>{{rep_email}}</p>
      <p>{{rep_phone}}</p>
    </div>
  </div>

  <div class="system-box">
    <h3>Recommended System</h3>
    <p>{{recommended_system}}</p>
  </div>

  {{household_section}}
  {{water_test_section}}
  {{water_concerns_section}}
  {{products_section}}

  <div class="signature-section">
    <h2>Agreement</h2>
    <p>By signing below, the customer acknowledges and agrees to the installation of the recommended water treatment system at the service address listed above.</p>
    <div class="sig-line">
      <div class="sig-block">
        <div class="line"></div>
        <p><strong>Customer Signature</strong></p>
        <p>{{customer_name}}</p>
        <p>Date: _______________</p>
      </div>
      <div class="sig-block">
        <div class="line"></div>
        <p><strong>Company Representative</strong></p>
        <p>{{rep_name}}</p>
        <p>Date: _______________</p>
      </div>
    </div>
  </div>

  <div class="terms">
    <p>This contract is subject to the standard terms and conditions of {{company_name}}. Installation scheduling will be confirmed upon receipt of signed agreement.</p>
  </div>
</body>
</html>`;

const AVAILABLE_VARIABLES = [
  { key: '{{company_name}}', desc: 'Dealership name' },
  { key: '{{company_address}}', desc: 'Dealership address' },
  { key: '{{company_phone}}', desc: 'Dealership phone' },
  { key: '{{customer_name}}', desc: 'Customer full name' },
  { key: '{{customer_address}}', desc: 'Service address' },
  { key: '{{customer_email}}', desc: 'Customer email' },
  { key: '{{customer_phone}}', desc: 'Customer phone' },
  { key: '{{rep_name}}', desc: 'Sales rep name' },
  { key: '{{rep_email}}', desc: 'Sales rep email' },
  { key: '{{rep_phone}}', desc: 'Sales rep phone' },
  { key: '{{recommended_system}}', desc: 'System recommendation' },
  { key: '{{date}}', desc: 'Current date' },
  { key: '{{household_section}}', desc: 'Auto-generated household details table' },
  { key: '{{water_test_section}}', desc: 'Auto-generated water test results table' },
  { key: '{{water_concerns_section}}', desc: 'Customer water concerns' },
  { key: '{{products_section}}', desc: 'Auto-generated products, discounts & pricing table' },
];

export function ContractTemplatesCard() {
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [htmlContent, setHtmlContent] = useState(DEFAULT_TEMPLATE);
  const [isDefault, setIsDefault] = useState(false);

  const { toast } = useToast();
  const { profile } = useAuth();

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('contract_templates')
      .select('*')
      .order('is_default', { ascending: false })
      .order('name');

    if (!error && data) {
      setTemplates(data);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setHtmlContent(DEFAULT_TEMPLATE);
    setIsDefault(false);
    setEditingTemplate(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleOpenEdit = (template: ContractTemplate) => {
    setEditingTemplate(template);
    setName(template.name);
    setDescription(template.description || '');
    setHtmlContent(template.html_content);
    setIsDefault(template.is_default);
    setDialogOpen(true);
  };

  const handlePreview = (html: string) => {
    // Replace variables with sample data for preview
    const previewData: Record<string, string> = {
      '{{company_name}}': 'Acme Water Solutions',
      '{{company_address}}': '123 Main St, Austin, TX 78701',
      '{{company_phone}}': '(555) 123-4567',
      '{{customer_name}}': 'John Smith',
      '{{customer_address}}': '456 Oak Ave, Austin, TX 78702',
      '{{customer_email}}': 'john.smith@email.com',
      '{{customer_phone}}': '(555) 987-6543',
      '{{rep_name}}': 'Jane Doe',
      '{{rep_email}}': 'jane@acmewater.com',
      '{{rep_phone}}': '(555) 111-2222',
      '{{recommended_system}}': 'Home: 6-10 years, 3-4 people, City/Municipal Water',
      '{{date}}': new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      '{{household_section}}': '<h2>Property Details</h2><table><thead><tr><th>Detail</th><th>Value</th></tr></thead><tbody><tr><td>Home Age</td><td>6-10 years</td></tr><tr><td>Household Size</td><td>3-4 people</td></tr><tr><td>Water Source</td><td>City/Municipal Water</td></tr></tbody></table>',
      '{{water_test_section}}': '<h2>Water Test Results</h2><table><thead><tr><th>Parameter</th><th>Value</th></tr></thead><tbody><tr><td>Hardness</td><td>15 gpg</td></tr><tr><td>Iron</td><td>0.5 ppm</td></tr><tr><td>pH Level</td><td>7.2</td></tr></tbody></table>',
      '{{water_concerns_section}}': '<h2>Customer Concerns</h2><p>Hard water buildup, chlorine taste</p>',
      '{{products_section}}': '<h2>System Components &amp; Pricing</h2><table><thead><tr><th>Product</th><th>Description</th><th style="text-align:right">Price</th></tr></thead><tbody><tr><td>Whole House Softener</td><td>High-capacity water softener</td><td style="text-align:right">$2,499.00</td></tr><tr><td>RO Drinking System</td><td>Under-sink reverse osmosis</td><td style="text-align:right">$899.00</td></tr><tr style="border-top:2px solid #e0e0e0"><td colspan="2" style="font-weight:600">Subtotal</td><td style="text-align:right;font-weight:600">$3,398.00</td></tr><tr style="color:#16a34a"><td colspan="2">Discount (SAVE20 — 20% off)</td><td style="text-align:right">-$679.60</td></tr><tr style="border-top:2px solid #0077b6"><td colspan="2" style="font-weight:700;font-size:12pt">Total</td><td style="text-align:right;font-weight:700;font-size:12pt;color:#0077b6">$2,718.40</td></tr></tbody></table>',
    };

    let preview = html;
    Object.entries(previewData).forEach(([key, value]) => {
      preview = preview.split(key).join(value);
    });

    setPreviewHtml(preview);
    setPreviewOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !htmlContent.trim()) {
      toast({ title: 'Missing fields', description: 'Name and HTML content are required.', variant: 'destructive' });
      return;
    }
    if (!profile?.dealership_id) return;

    setSaving(true);
    try {
      // If setting as default, unset existing defaults
      if (isDefault) {
        await supabase
          .from('contract_templates')
          .update({ is_default: false })
          .eq('dealership_id', profile.dealership_id)
          .eq('is_default', true);
      }

      if (editingTemplate) {
        const { error } = await supabase
          .from('contract_templates')
          .update({
            name: name.trim(),
            description: description.trim() || null,
            html_content: htmlContent,
            is_default: isDefault,
          })
          .eq('id', editingTemplate.id);
        if (error) throw error;
        toast({ title: 'Template updated!' });
      } else {
        const { error } = await supabase
          .from('contract_templates')
          .insert({
            dealership_id: profile.dealership_id,
            name: name.trim(),
            description: description.trim() || null,
            html_content: htmlContent,
            is_default: isDefault,
            created_by: (await supabase.auth.getUser()).data.user!.id,
          });
        if (error) throw error;
        toast({ title: 'Template created!' });
      }

      setDialogOpen(false);
      resetForm();
      fetchTemplates();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to save template', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const { error } = await supabase.from('contract_templates').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Template deleted' });
      fetchTemplates();
    } catch {
      toast({ title: 'Failed to delete', variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    if (!profile?.dealership_id) return;
    try {
      await supabase
        .from('contract_templates')
        .update({ is_default: false })
        .eq('dealership_id', profile.dealership_id)
        .eq('is_default', true);
      
      await supabase
        .from('contract_templates')
        .update({ is_default: true })
        .eq('id', id);
      
      toast({ title: 'Default template updated' });
      fetchTemplates();
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  };

  return (
    <>
      <Card className="border-0 shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Contract Templates
              </CardTitle>
              <CardDescription>
                Create and manage HTML templates for contract generation. Use variables like {'{{customer_name}}'} for dynamic content.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleOpenCreate}>
              <Plus className="w-4 h-4 mr-1" />
              Add Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No contract templates yet</p>
              <p className="text-sm">Create your first template to customize contract documents</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={handleOpenCreate}>
                <Plus className="w-4 h-4 mr-1" />
                Create First Template
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <div key={template.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{template.name}</span>
                      {template.is_default && (
                        <Badge variant="default" className="text-xs">Default</Badge>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-sm text-muted-foreground truncate">{template.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => handlePreview(template.html_content)} title="Preview">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(template)} title="Edit">
                      <Edit className="w-4 h-4" />
                    </Button>
                    {!template.is_default && (
                      <Button variant="ghost" size="sm" onClick={() => handleSetDefault(template.id)} title="Set as default">
                        <Star className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(template.id)}
                      disabled={deleting === template.id}
                      title="Delete"
                    >
                      {deleting === template.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Contract Template'}</DialogTitle>
            <DialogDescription>
              Write an HTML template with variables that will be replaced with proposal data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tpl-name">Template Name</Label>
                <Input id="tpl-name" placeholder="e.g., Standard Contract" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-desc">Description (optional)</Label>
                <Input id="tpl-desc" placeholder="e.g., Basic installation agreement" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>HTML Content</Label>
                <Button variant="ghost" size="sm" onClick={() => handlePreview(htmlContent)}>
                  <Eye className="w-4 h-4 mr-1" />
                  Preview
                </Button>
              </div>
              <Textarea
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                className="font-mono text-xs min-h-[300px]"
                placeholder="Enter HTML template..."
              />
            </div>

            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors font-medium">
                Available Variables
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-2 p-3 bg-muted/50 rounded-lg">
                {AVAILABLE_VARIABLES.map((v) => (
                  <div key={v.key} className="flex items-start gap-2">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono whitespace-nowrap">{v.key}</code>
                    <span className="text-xs text-muted-foreground">{v.desc}</span>
                  </div>
                ))}
              </div>
            </details>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="tpl-default"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="tpl-default" className="text-sm cursor-pointer">Set as default template</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="water" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-1" />Saving...</> : editingTemplate ? 'Update Template' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Template Preview</DialogTitle>
            <DialogDescription>Preview with sample data. Actual contracts will use real proposal data.</DialogDescription>
          </DialogHeader>
          <div className="border rounded-lg overflow-auto max-h-[70vh] bg-white">
            <iframe
              srcDoc={previewHtml}
              className="w-full min-h-[600px]"
              title="Template Preview"
              sandbox=""
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
