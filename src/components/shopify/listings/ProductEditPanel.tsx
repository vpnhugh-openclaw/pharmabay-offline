import { useState, useEffect } from "react";
import { WysiwygEditor } from "./WysiwygEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Save, Trash2, RotateCcw } from "lucide-react";

interface Props {
  product: any;
  onClose: () => void;
  onSaved: () => void;
}

export function ProductEditPanel({ product, onClose, onSaved }: Props) {
  const raw = product.edited_json
    ? JSON.parse(product.edited_json)
    : JSON.parse(product.data_json);

  const [title, setTitle] = useState<string>(raw.title ?? "");
  const [vendor, setVendor] = useState<string>(raw.vendor ?? "");
  const [productType, setProductType] = useState<string>(raw.product_type ?? "");
  const [status, setStatus] = useState<string>(raw.status ?? "active");
  const [tags, setTags] = useState<string>(
    Array.isArray(raw.tags) ? raw.tags.join(", ") : (raw.tags ?? "")
  );
  const [bodyHtml, setBodyHtml] = useState<string>(raw.body_html ?? "");
  const [variants, setVariants] = useState<any[]>(raw.variants ?? []);

  const [saving, setSaving] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when a different product is opened
  useEffect(() => {
    const p = product.edited_json
      ? JSON.parse(product.edited_json)
      : JSON.parse(product.data_json);
    setTitle(p.title ?? "");
    setVendor(p.vendor ?? "");
    setProductType(p.product_type ?? "");
    setStatus(p.status ?? "active");
    setTags(Array.isArray(p.tags) ? p.tags.join(", ") : (p.tags ?? ""));
    setBodyHtml(p.body_html ?? "");
    setVariants(p.variants ?? []);
    setError(null);
  }, [product.id]);

  const updateVariant = (idx: number, field: string, value: string) => {
    setVariants((prev) => prev.map((v, i) => i === idx ? { ...v, [field]: value } : v));
  };

  const buildEditedProduct = () => ({
    ...raw,
    title,
    vendor,
    product_type: productType,
    status,
    tags: tags.split(",").map((t) => t.trim()).filter(Boolean).join(", "),
    body_html: bodyHtml,
    variants,
  });

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await window.electronAPI.shopifySaveListing({
        product_id: String(product.shopify_id),
        edited_product: buildEditedProduct(),
      });
      if (res.error) { setError(res.error); return; }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = async () => {
    setDiscarding(true);
    setError(null);
    try {
      const res = await window.electronAPI.shopifyDiscardListingEdits({
        product_id: String(product.shopify_id),
      });
      if (res.error) { setError(res.error); return; }
      onSaved();
    } finally {
      setDiscarding(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-sm truncate">{raw.title}</span>
          {product.has_edits ? (
            <Badge variant="outline" className="text-amber-600 border-amber-400 text-[10px]">Edited</Badge>
          ) : null}
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground ml-2 shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

        {/* Core fields */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 text-sm" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Vendor</Label>
            <Input value={vendor} onChange={(e) => setVendor(e.target.value)} className="h-8 text-sm" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Product Type</Label>
            <Input value={productType} onChange={(e) => setProductType(e.target.value)} className="h-8 text-sm" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Tags (comma-separated)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} className="h-8 text-sm" placeholder="tag1, tag2, tag3" />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1">
          <Label className="text-xs">Description (HTML)</Label>
          <WysiwygEditor value={bodyHtml} onChange={setBodyHtml} placeholder="Product description…" />
        </div>

        {/* Variants */}
        {variants.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs">Variants</Label>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-medium w-1/5">Variant</th>
                    <th className="text-left px-2 py-1.5 font-medium w-1/5">SKU</th>
                    <th className="text-left px-2 py-1.5 font-medium w-1/5">Barcode</th>
                    <th className="text-left px-2 py-1.5 font-medium w-1/5">Price</th>
                    <th className="text-left px-2 py-1.5 font-medium w-1/5">Compare At</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v, idx) => (
                    <tr key={v.id ?? idx} className="border-t">
                      <td className="px-2 py-1 text-muted-foreground">
                        {v.title === "Default Title" ? "—" : v.title}
                      </td>
                      <td className="px-1 py-0.5">
                        <Input
                          value={v.sku ?? ""}
                          onChange={(e) => updateVariant(idx, "sku", e.target.value)}
                          className="h-6 text-xs px-1.5"
                        />
                      </td>
                      <td className="px-1 py-0.5">
                        <Input
                          value={v.barcode ?? ""}
                          onChange={(e) => updateVariant(idx, "barcode", e.target.value)}
                          className="h-6 text-xs px-1.5"
                        />
                      </td>
                      <td className="px-1 py-0.5">
                        <Input
                          value={v.price ?? ""}
                          onChange={(e) => updateVariant(idx, "price", e.target.value)}
                          className="h-6 text-xs px-1.5"
                        />
                      </td>
                      <td className="px-1 py-0.5">
                        <Input
                          value={v.compare_at_price ?? ""}
                          onChange={(e) => updateVariant(idx, "compare_at_price", e.target.value)}
                          className="h-6 text-xs px-1.5"
                          placeholder="—"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>
        )}
      </div>

      {/* Footer actions */}
      <div className="shrink-0 border-t px-4 py-3 flex items-center gap-2 bg-background">
        <Button size="sm" onClick={handleSave} disabled={saving || discarding} className="gap-1.5">
          <Save className="h-3.5 w-3.5" />
          {saving ? "Saving…" : "Save Changes"}
        </Button>
        {product.has_edits && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleDiscard}
            disabled={saving || discarding}
            className="gap-1.5 text-amber-600 border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {discarding ? "Discarding…" : "Discard Edits"}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onClose} disabled={saving || discarding} className="ml-auto">
          Close
        </Button>
      </div>
    </div>
  );
}
