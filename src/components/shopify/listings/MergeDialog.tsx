import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeftRight, CopyCheck, Trash2, X, Loader2, AlertTriangle, ChevronRight } from "lucide-react";

interface Props {
  /** Two listing rows from shopify_listings (with data_json / edited_json) */
  products: [any, any];
  reason?: string;
  onClose: () => void;
  onMerged: () => void;
}

type Field =
  | { key: string; label: string; type: "text" | "number" | "status"; variantField?: false }
  | { key: string; label: string; type: "text" | "number"; variantField: true };

const FIELDS: Field[] = [
  { key: "title",        label: "Title",        type: "text" },
  { key: "vendor",       label: "Vendor",       type: "text" },
  { key: "status",       label: "Status",       type: "status" },
  { key: "product_type", label: "Category",     type: "text" },
  { key: "tags",         label: "Tags",         type: "text" },
  { key: "price",        label: "Price",        type: "number", variantField: true },
  { key: "compare_at_price", label: "Compare At", type: "number", variantField: true },
  { key: "sku",          label: "SKU",          type: "text",   variantField: true },
  { key: "barcode",      label: "Barcode",      type: "text",   variantField: true },
  { key: "inventory_quantity", label: "SOH",    type: "number", variantField: true },
];

function parseProduct(row: any) {
  const data = row.edited_json ? JSON.parse(row.edited_json) : JSON.parse(row.data_json);
  const v0 = data.variants?.[0] ?? {};
  return { ...data, _v0: v0, _row: row };
}

function getField(p: ReturnType<typeof parseProduct>, field: Field): string {
  if (field.variantField) return String(p._v0[field.key] ?? "");
  if (field.key === "tags") return Array.isArray(p.tags) ? p.tags.join(", ") : String(p.tags ?? "");
  return String(p[field.key] ?? "");
}

export function MergeDialog({ products, reason, onClose, onMerged }: Props) {
  const [keepIdx, setKeepIdx] = useState<0 | 1>(0);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const keepRow    = products[keepIdx];
  const discardRow = products[keepIdx === 0 ? 1 : 0];

  const [keepData, setKeepData] = useState(() => parseProduct(keepRow));
  const [discardData]            = useState(() => parseProduct(discardRow));

  // Rebuild keepData when keepIdx swaps
  const swap = () => {
    const newIdx = keepIdx === 0 ? 1 : 0;
    setKeepIdx(newIdx);
    setKeepData(parseProduct(products[newIdx]));
    setConfirmDelete(false);
  };

  const setField = useCallback((field: Field, value: string) => {
    setKeepData((prev) => {
      if (field.variantField) {
        const variants = prev.variants ? [...prev.variants] : [{ ...prev._v0 }];
        variants[0] = { ...variants[0], [field.key]: field.type === "number" ? Number(value) : value };
        return { ...prev, variants, _v0: variants[0] };
      }
      if (field.key === "tags") return { ...prev, tags: value };
      return { ...prev, [field.key]: value };
    });
  }, []);

  const copyFromDiscard = useCallback((field: Field) => {
    setField(field, getField(discardData, field));
  }, [discardData, setField]);

  const handleMerge = async () => {
    setMerging(true);
    setError(null);
    try {
      // Build final edited product
      const edited = { ...keepData };
      delete (edited as any)._v0;
      delete (edited as any)._row;
      if (edited.tags && !Array.isArray(edited.tags)) {
        edited.tags = String(edited.tags).split(",").map((t: string) => t.trim()).filter(Boolean).join(", ");
      }

      // Save edits to the keep product
      const saveRes = await window.electronAPI.shopifySaveListing({
        product_id: String(keepRow.shopify_id),
        edited_product: edited,
      });
      if (saveRes.error) { setError(saveRes.error); return; }

      // Delete the discard product from Shopify + local cache
      const delRes = await window.electronAPI.shopifyDeleteListing({
        shopify_product_id: Number(discardRow.shopify_id),
        delete_from_shopify: true,
      });
      if (delRes.error) { setError(delRes.error); return; }

      onMerged();
    } catch (err: any) {
      setError(err.message ?? "Unknown error");
    } finally {
      setMerging(false);
    }
  };

  const thumb = (p: ReturnType<typeof parseProduct>) => p.images?.[0]?.src ?? null;
  const fmt = (v: string, type: Field["type"]) =>
    v === "" ? <span className="text-muted-foreground/40 italic">—</span> : (
      type === "number" && v !== "" ? `$${Number(v).toFixed(2)}` : v
    );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-auto p-4">
      <div className="w-full max-w-5xl bg-background rounded-lg shadow-2xl flex flex-col my-4">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b shrink-0">
          <div>
            <h2 className="text-sm font-semibold">Merge Duplicate Listings</h2>
            {reason && <p className="text-xs text-muted-foreground mt-0.5">{reason}</p>}
          </div>
          <Button size="sm" variant="outline" className="ml-auto gap-1.5 h-7" onClick={swap}>
            <ArrowLeftRight className="h-3.5 w-3.5" /> Swap Keep / Discard
          </Button>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_36px_1fr] gap-0 border-b">
          {/* Keep header */}
          <div className="px-4 py-2 bg-green-50 dark:bg-green-950/30 flex items-center gap-2">
            <Badge className="bg-green-600 text-white text-[10px]">KEEP</Badge>
            <div className="flex items-center gap-2 min-w-0">
              {thumb(keepData) && <img src={thumb(keepData)!} alt="" className="h-8 w-8 object-cover rounded shrink-0" />}
              <span className="text-xs font-medium truncate">{keepData.title}</span>
            </div>
            <span className="ml-auto text-[10px] text-muted-foreground shrink-0">ID: {keepRow.shopify_id}</span>
          </div>
          <div className="border-l border-r" />
          {/* Discard header */}
          <div className="px-4 py-2 bg-red-50 dark:bg-red-950/30 flex items-center gap-2">
            <Badge variant="outline" className="border-red-400 text-red-500 text-[10px]">DISCARD</Badge>
            <div className="flex items-center gap-2 min-w-0">
              {thumb(discardData) && <img src={thumb(discardData)!} alt="" className="h-8 w-8 object-cover rounded shrink-0" />}
              <span className="text-xs font-medium truncate text-muted-foreground">{discardData.title}</span>
            </div>
            <span className="ml-auto text-[10px] text-muted-foreground shrink-0">ID: {discardRow.shopify_id}</span>
          </div>
        </div>

        {/* Field rows */}
        <div className="flex-1 overflow-y-auto divide-y">
          {FIELDS.map((field) => {
            const keepVal    = getField(keepData, field);
            const discardVal = getField(discardData, field);
            const differs    = keepVal !== discardVal;

            return (
              <div
                key={field.key}
                className={`grid grid-cols-[1fr_36px_1fr] ${differs ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}`}
              >
                {/* Keep side — editable */}
                <div className="px-4 py-2 flex items-center gap-2">
                  <Label className="text-[10px] text-muted-foreground w-20 shrink-0">{field.label}</Label>
                  {field.type === "status" ? (
                    <Select value={keepVal} onValueChange={(v) => setField(field, v)}>
                      <SelectTrigger className="h-6 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">active</SelectItem>
                        <SelectItem value="draft">draft</SelectItem>
                        <SelectItem value="archived">archived</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type={field.type === "number" ? "number" : "text"}
                      step={field.type === "number" ? "0.01" : undefined}
                      value={keepVal}
                      onChange={(e) => setField(field, e.target.value)}
                      className="h-6 text-xs flex-1"
                    />
                  )}
                </div>

                {/* Copy button */}
                <div className="flex items-center justify-center border-l border-r">
                  {differs && (
                    <button
                      title={`Copy "${discardVal}" to Keep`}
                      onClick={() => copyFromDiscard(field)}
                      className="p-1 rounded hover:bg-primary/10 text-primary"
                    >
                      <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                    </button>
                  )}
                </div>

                {/* Discard side — read only */}
                <div className="px-4 py-2 flex items-center gap-2">
                  <Label className="text-[10px] text-muted-foreground w-20 shrink-0">{field.label}</Label>
                  <span className="text-xs flex-1 truncate text-muted-foreground">{fmt(discardVal, field.type)}</span>
                  {differs && (
                    <button
                      title="Copy this value to Keep"
                      onClick={() => copyFromDiscard(field)}
                      className="shrink-0 p-1 rounded hover:bg-primary/10 text-primary opacity-60 hover:opacity-100"
                    >
                      <CopyCheck className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Description comparison */}
          <div className="grid grid-cols-[1fr_36px_1fr]">
            <div className="px-4 py-2">
              <Label className="text-[10px] text-muted-foreground block mb-1">Description (HTML)</Label>
              <textarea
                value={keepData.body_html ?? ""}
                onChange={(e) => setKeepData((p) => ({ ...p, body_html: e.target.value }))}
                rows={5}
                className="w-full text-xs font-mono border rounded px-2 py-1 bg-background resize-y focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex items-center justify-center border-l border-r">
              <button
                title="Copy description from Discard"
                onClick={() => setKeepData((p) => ({ ...p, body_html: discardData.body_html ?? "" }))}
                className="p-1 rounded hover:bg-primary/10 text-primary"
              >
                <ChevronRight className="h-3.5 w-3.5 rotate-180" />
              </button>
            </div>
            <div className="px-4 py-2">
              <Label className="text-[10px] text-muted-foreground block mb-1">Description (HTML)</Label>
              <div
                className="text-xs text-muted-foreground border rounded px-2 py-1 bg-muted/30 overflow-y-auto max-h-[120px] prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: discardData.body_html ?? "<em>No description</em>" }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t px-5 py-3 flex items-center gap-3 bg-background">
          {error && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> {error}
            </p>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={onClose} disabled={merging}>Cancel</Button>
            {!confirmDelete ? (
              <Button
                size="sm"
                className="gap-1.5 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => setConfirmDelete(true)}
                disabled={merging}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Merge &amp; Delete Discarded
              </Button>
            ) : (
              <Button
                size="sm"
                className="gap-1.5 bg-red-700 hover:bg-red-800 text-white"
                onClick={handleMerge}
                disabled={merging}
              >
                {merging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                {merging ? "Merging…" : `Confirm — permanently delete "${discardData.title}"?`}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
