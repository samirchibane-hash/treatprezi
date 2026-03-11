import { useState, useEffect } from 'react';
import { Package, Plus, Pencil, Trash2, Loader2, Upload, Image, X, Sparkles } from 'lucide-react';
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

interface Product {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  is_active: boolean;
  image_url: string | null;
  highlights: string[];
}

export function ProductCatalogCard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    is_active: true,
    image_url: '' as string | null,
    highlights: ['', '', '', '', ''],
  });
  const { toast } = useToast();
  const { profile } = useAuth();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name');

    if (!error && data) {
      setProducts(data as unknown as Product[]);
    }
    setLoading(false);
  };

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Free';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const openAddDialog = () => {
    setEditingProduct(null);
    setFormData({ name: '', description: '', price: '', is_active: true, image_url: null, highlights: ['', '', '', '', ''] });
    setDialogOpen(true);
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    const highlights = [...(product.highlights || [])];
    while (highlights.length < 5) highlights.push('');
    setFormData({
      name: product.name,
      description: product.description || '',
      price: (product.price_cents / 100).toFixed(2),
      is_active: product.is_active,
      image_url: product.image_url,
      highlights: highlights.slice(0, 5),
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (product: Product) => {
    setDeletingProduct(product);
    setDeleteDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.dealership_id) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${profile.dealership_id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('product-images').upload(fileName, file);
      if (uploadErr) throw uploadErr;
      const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
      setFormData((prev) => ({ ...prev, image_url: data.publicUrl }));
      toast({ title: 'Image uploaded' });
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({ ...prev, image_url: null }));
  };

  const updateHighlight = (index: number, value: string) => {
    setFormData((prev) => {
      const highlights = [...prev.highlights];
      highlights[index] = value;
      return { ...prev, highlights };
    });
  };

  const handleSave = async () => {
    const priceCents = Math.round(parseFloat(formData.price) * 100);
    if (!formData.name.trim() || isNaN(priceCents) || priceCents < 0) {
      toast({ title: 'Invalid input', description: 'Please enter a valid name and price.', variant: 'destructive' });
      return;
    }

    const filteredHighlights = formData.highlights.filter((h) => h.trim() !== '');

    setSaving(true);
    try {
      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            price_cents: priceCents,
            is_active: formData.is_active,
            image_url: formData.image_url || null,
            highlights: filteredHighlights,
          } as any)
          .eq('id', editingProduct.id);
        if (error) throw error;
        toast({ title: 'Product updated' });
      } else {
        if (!profile?.dealership_id) throw new Error('No dealership');
        const { error } = await supabase.from('products').insert({
          dealership_id: profile.dealership_id,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          price_cents: priceCents,
          is_active: formData.is_active,
          image_url: formData.image_url || null,
          highlights: filteredHighlights,
        } as any);
        if (error) throw error;
        toast({ title: 'Product added' });
      }
      setDialogOpen(false);
      fetchProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      toast({ title: 'Error', description: 'Failed to save product', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingProduct) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', deletingProduct.id);
      if (error) throw error;
      toast({ title: 'Product deleted' });
      setDeleteDialogOpen(false);
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({ title: 'Error', description: 'Failed to delete product', variant: 'destructive' });
    }
  };

  return (
    <>
      <Card className="border-0 shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Product Catalog
              </CardTitle>
              <CardDescription>
                Manage products and services that can be added to invoices
              </CardDescription>
            </div>
            <Button variant="water" size="sm" onClick={openAddDialog}>
              <Plus className="w-4 h-4" />
              Add Product
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No products yet</p>
              <p className="text-sm">Add your first product to start creating invoices</p>
            </div>
          ) : (
            <div className="space-y-3">
              {products.map((product) => (
                <div
                  key={product.id}
                  className={`flex items-start gap-4 p-4 rounded-lg border bg-card transition-opacity ${
                    !product.is_active ? 'opacity-50' : ''
                  }`}
                >
                  {/* Product Image */}
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <Image className="w-6 h-6 text-muted-foreground/40" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{product.name}</span>
                      {!product.is_active && (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">Inactive</span>
                      )}
                    </div>
                    {product.description && (
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-1">{product.description}</p>
                    )}
                    {product.highlights && product.highlights.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {product.highlights.map((h, i) => (
                          <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            {h}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`font-semibold whitespace-nowrap ${product.price_cents === 0 ? 'text-green-600 dark:text-green-400' : 'text-primary'}`}>
                      {formatPrice(product.price_cents)}
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(product)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => openDeleteDialog(product)}>
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
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add Product'}</DialogTitle>
            <DialogDescription>
              {editingProduct ? 'Update the product details below.' : 'Add a new product or service to your catalog.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Product Image</Label>
              {formData.image_url ? (
                <div className="relative w-full h-40 rounded-lg overflow-hidden border bg-muted">
                  <img src={formData.image_url} alt="Product" className="w-full h-full object-cover" />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 w-7 h-7"
                    onClick={handleRemoveImage}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors">
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                  {uploading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                      <span className="text-sm text-muted-foreground">Click to upload image</span>
                    </>
                  )}
                </label>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Product Name</Label>
              <Input
                id="name"
                placeholder="e.g., Whole House Water Softener"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Brief description of the product or service"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price (USD)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              />
            </div>

            {/* Highlights */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Key Highlights
              </Label>
              <p className="text-xs text-muted-foreground">Add up to 5 key selling points for this product.</p>
              <div className="space-y-2">
                {formData.highlights.map((h, i) => (
                  <Input
                    key={i}
                    placeholder={`Highlight ${i + 1}`}
                    value={h}
                    onChange={(e) => updateHighlight(i, e.target.value)}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="active">Active</Label>
              <Switch
                id="active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="water" onClick={handleSave} disabled={saving}>
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
              ) : editingProduct ? 'Save Changes' : 'Add Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deletingProduct?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
