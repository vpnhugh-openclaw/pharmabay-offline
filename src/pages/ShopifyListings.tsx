import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ProductEditPanel } from "@/components/shopify/listings/ProductEditPanel";
import {
  RefreshCw, Upload, Download, Search, ChevronUp, ChevronDown,
  Edit2, CheckSquare, Square, Loader2, ArchiveX, EyeOff, X,
} from "lucide-react";

type SortKey = "title" | "vendor" | "status" | "has_edits" | "_price" | "_stock_on_hand" | "_units_sold_12m";
type SortDir = "asc" | "desc";

const fmt = {
  price: (v: any) => v == null || v === "" ? "—" : `$${Number(v).toFixed(2)}`,
  pct:   (v: any) => v == null ? "—" : `${Number(v).toFixed(1)}%`,
  int:   (v: any) => v == null ? "—" : String(Math.round(Number(v))),
};

const STATUS_COLORS: Record<string, string> = {
  active:   "text-green-600 border-green-400",
  draft:    "text-amber-600 border-amber-400",
  archived: "text-muted-foreground",
};

export function ShopifyListings() {
  const [rows, setRows]       = useState<any[]>([]);
  const [vendors, setVendors] = useState<string[]>([]);
  const [total, setTotal]     = useState(0);

  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [editsOnly, setEditsOnly]     = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [selected, setSelected]           = useState<Set<string>>(new Set());
  const [editingProduct, setEditingProduct] = useState<any | null>(null);

  // Inline cell editing
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null);
  const [cellDraft, setCellDraft]     = useState("");
  const cellInputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  const [loading, setLoading]       = useState(false);
  const [pushing, setPushing]       = useState(false);
  const [exporting, setExporting]   = useState(false);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [statusMsg, setStatusMsg]   = useState<{ text: string; ok: boolean } | null>(null);

  const showStatus = (text: string, ok = true) => {
    setStatusMsg({ text, ok });
    setTimeout(() => setStatusMsg(null), 6000);
  };

  const fetchListings = useCallback(async () => {
    const opts: any = {};
    if (search) opts.search = search;
    if (statusFilter !== "all") opts.status = statusFilter;
    if (vendorFilter !== "all") opts.vendor = vendorFilter;
    if (editsOnly) opts.has_edits = true;
    const res = await window.electronAPI.shopifyGetListings(opts);
    if (res.error) { showStatus(res.error, false); return; }
    if (res.data) { setRows(res.data.rows); setVendors(res.data.vendors); setTotal(res.data.total); }
  }, [search, statusFilter, vendorFilter, editsOnly]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  // ── Toolbar actions ───────────────────────────────────────────────────────
  const handleLoadFromShopify = async () => {
    setLoading(true); setStatusMsg(null);
    try {
      const res = await window.electronAPI.shopifyLoadListings();
      if (res.error) { showStatus(res.error, false); return; }
      if (res.data) showStatus(`Loaded ${res.data.loaded} products (${res.data.apiCalls} API calls)`);
      await fetchListings();
    } finally { setLoading(false); }
  };

  const handlePush = async () => {
    setPushing(true); setStatusMsg(null);
    try {
      const res = await window.electronAPI.shopifyPushListingEdits();
      if (res.error) { showStatus(res.error, false); return; }
      if (res.data) {
        const { synced, failed, errors } = res.data;
        showStatus(
          `Pushed ${synced} product(s)${failed ? ` · ${failed} failed` : ""}${errors?.length ? ": " + errors.join("; ") : ""}`,
          failed === 0,
        );
      }
      await fetchListings();
    } finally { setPushing(false); }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const dlg = await window.electronAPI.shopifySaveDialog({ title: "Export Listings CSV", defaultPath: "shopify_listings.csv", filters: [{ name: "CSV", extensions: ["csv"] }] });
      if (dlg.canceled || !dlg.data) return;
      const res = await window.electronAPI.shopifyExportListingsCsv({ file_path: dlg.data, include_edits: true });
      if (res.error) { showStatus(res.error, false); return; }
      if (res.data) showStatus(`Exported ${res.data.rows} rows`);
    } finally { setExporting(false); }
  };

  const handleBulk = async (patch: Record<string, any>, label: string) => {
    setBulkWorking(true);
    try {
      const res = await window.electronAPI.shopifyBulkUpdateListings({ product_ids: [...selected], patch });
      if (res.error) { showStatus(res.error, false); return; }
      showStatus(`${label}: ${res.data?.updated} product(s) staged — press Upload to push`);
      setSelected(new Set());
      await fetchListings();
    } finally { setBulkWorking(false); }
  };

  // ── Inline cell editing ───────────────────────────────────────────────────
  const startEdit = (e: React.MouseEvent, row: any, field: string, value: string) => {
    e.stopPropagation();
    setEditingCell({ rowId: row.id, field });
    setCellDraft(String(value ?? ""));
  };

  const commitCellEdit = async (row: any, field: string, value: string) => {
    setEditingCell(null);
    const trimmed = value.trim();

    if (field === "cost") {
      // Update local products table only
      const cost = parseFloat(trimmed);
      if (!isNaN(cost) && (row._barcode || row._sku)) {
        const col = row._barcode ? "barcode" : "sku";
        const key = row._barcode || row._sku;
        await window.electronAPI.dbQuery(
          `UPDATE products SET cost_price = ?, updated_at = ? WHERE ${col} = ?`,
          [cost, new Date().toISOString(), key],
        );
      }
      await fetchListings();
      return;
    }

    // All other fields → stage in edited_json
    const data = JSON.parse(row.data_json);
    const edited: any = row.edited_json ? JSON.parse(row.edited_json) : { ...data };

    if (field === "status") {
      edited.status = trimmed;
    } else if (field === "product_type") {
      edited.product_type = trimmed;
    } else if (field === "price") {
      if (!edited.variants) edited.variants = JSON.parse(JSON.stringify(data.variants ?? []));
      if (edited.variants[0]) edited.variants[0].price = trimmed;
    } else if (field === "barcode") {
      if (!edited.variants) edited.variants = JSON.parse(JSON.stringify(data.variants ?? []));
      if (edited.variants[0]) edited.variants[0].barcode = trimmed;
    } else if (field === "inventory_quantity") {
      if (!edited.variants) edited.variants = JSON.parse(JSON.stringify(data.variants ?? []));
      if (edited.variants[0]) {
        edited.variants[0].inventory_quantity = parseInt(trimmed) || 0;
        // Preserve inventory_item_id for push
        if (!edited.variants[0].inventory_item_id && data.variants?.[0]?.inventory_item_id) {
          edited.variants[0].inventory_item_id = data.variants[0].inventory_item_id;
        }
      }
    }

    await window.electronAPI.shopifySaveListing({ product_id: String(row.shopify_id), edited_product: edited });
    await fetchListings();
  };

  const cellKeyDown = (e: React.KeyboardEvent, row: any, field: string) => {
    if (e.key === "Enter") { e.preventDefault(); commitCellEdit(row, field, cellDraft); }
    if (e.key === "Escape") { setEditingCell(null); }
  };

  const isEditing = (rowId: string, field: string) =>
    editingCell?.rowId === rowId && editingCell?.field === field;

  // ── Sorting ───────────────────────────────────────────────────────────────
  const sortedRows = [...rows].sort((a, b) => {
    let av: any = a[sortKey] ?? "";
    let bv: any = b[sortKey] ?? "";
    const numericKeys: SortKey[] = ["_price", "_stock_on_hand", "_units_sold_12m"];
    if (numericKeys.includes(sortKey)) { av = av == null ? -Infinity : Number(av); bv = bv == null ? -Infinity : Number(bv); }
    else { av = String(av).toLowerCase(); bv = String(bv).toLowerCase(); }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SI = ({ k }: { k: SortKey }) => (
    sortKey === k
      ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />)
      : <ChevronUp className="h-3 w-3 ml-0.5 opacity-25" />
  );

  // ── Selection ─────────────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const allSelected = sortedRows.length > 0 && sortedRows.every((r) => selected.has(r.id));
  const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(sortedRows.map((r) => r.id)));

  const editsCount = rows.filter((r) => r.has_edits).length;

  const handleProductSaved = async () => {
    const res = await window.electronAPI.shopifyGetListings({});
    if (res.data) {
      setRows(res.data.rows); setVendors(res.data.vendors); setTotal(res.data.total);
      if (editingProduct) {
        const updated = res.data.rows.find((r: any) => r.id === editingProduct.id);
        if (updated) setEditingProduct(updated);
      }
    }
  };

  // ── Shared class strings ──────────────────────────────────────────────────
  const thL = "px-2 py-2 text-left font-medium text-[11px] uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:bg-muted/80";
  const thR = "px-2 py-2 text-right font-medium text-[11px] uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:bg-muted/80";
  const thS = "px-2 py-2 text-left font-medium text-[11px] uppercase tracking-wide whitespace-nowrap select-none";

  const inlineTdCls = "px-0 py-0.5";
  const inlineInputCls = "h-6 text-xs px-1.5 border-0 border-b-2 border-primary bg-primary/5 rounded-none focus:outline-none w-full tabular-nums";
  const editableCellCls = "cursor-text rounded px-1 hover:bg-primary/5 transition-colors";

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Main panel ───────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Toolbar */}
        <div className="shrink-0 border-b px-4 py-2 flex flex-wrap items-center gap-2 bg-muted/10">
          <span className="text-sm font-semibold mr-1">Shopify Listings</span>
          <Button size="sm" variant="outline" onClick={handleLoadFromShopify} disabled={loading} className="gap-1.5 h-7">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {loading ? "Loading…" : "Load from Shopify"}
          </Button>
          <Button size="sm" onClick={handlePush} disabled={pushing || editsCount === 0} className="gap-1.5 h-7">
            {pushing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {pushing ? "Pushing…" : `Upload / Sync${editsCount > 0 ? ` (${editsCount})` : ""}`}
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting || rows.length === 0} className="gap-1.5 h-7">
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export CSV
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">
            {total.toLocaleString()} products{editsCount > 0 ? ` · ${editsCount} pending` : ""}
          </span>
        </div>

        {/* Status bar */}
        {statusMsg && (
          <div className={`shrink-0 px-4 py-1.5 text-xs border-b flex items-center gap-2 ${statusMsg.ok ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300" : "bg-destructive/10 text-destructive"}`}>
            <span className="flex-1">{statusMsg.text}</span>
            <button onClick={() => setStatusMsg(null)}><X className="h-3 w-3" /></button>
          </div>
        )}

        {/* Filters */}
        <div className="shrink-0 border-b px-4 py-2 flex flex-wrap items-center gap-2 bg-background">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input placeholder="Title, SKU, barcode…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 pl-7 text-xs" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={vendorFilter} onValueChange={setVendorFilter}>
            <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="All vendors" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All vendors</SelectItem>
              {vendors.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <button
            onClick={() => setEditsOnly((p) => !p)}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border transition-colors ${editsOnly ? "border-amber-400 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300" : "border-border hover:bg-muted/50"}`}
          >
            {editsOnly ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
            Edits only
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs border-collapse" style={{ minWidth: 980 }}>
            <thead className="sticky top-0 z-10 bg-muted/80 border-b backdrop-blur">
              <tr>
                <th className="w-8 px-2 py-2 text-left">
                  <button onClick={toggleSelectAll}>
                    {allSelected ? <CheckSquare className="h-3.5 w-3.5 text-primary" /> : <Square className="h-3.5 w-3.5 text-muted-foreground" />}
                  </button>
                </th>
                <th className="w-10 px-1 py-2" />
                <th className={thL} onClick={() => toggleSort("title")}><span className="inline-flex items-center gap-0.5">Title<SI k="title" /></span></th>
                <th className={thL} onClick={() => toggleSort("vendor")}><span className="inline-flex items-center gap-0.5">Vendor<SI k="vendor" /></span></th>
                <th className={thS}>Status ✎</th>
                <th className={thR} onClick={() => toggleSort("_price")}><span className="inline-flex items-center justify-end gap-0.5">Price ✎<SI k="_price" /></span></th>
                <th className={thR}>Cost ✎</th>
                <th className={thR}>GP%</th>
                <th className={thR} onClick={() => toggleSort("_stock_on_hand")}><span className="inline-flex items-center justify-end gap-0.5">SOH ✎<SI k="_stock_on_hand" /></span></th>
                <th className={thR} onClick={() => toggleSort("_units_sold_12m")}><span className="inline-flex items-center justify-end gap-0.5">Sold 12m<SI k="_units_sold_12m" /></span></th>
                <th className={thS}>Barcode ✎</th>
                <th className={thS}>Category ✎</th>
                <th className={thS}>Tags</th>
                <th className={thS} onClick={() => toggleSort("has_edits")}><span className="inline-flex items-center gap-0.5">Edits<SI k="has_edits" /></span></th>
                <th className="w-8 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={16} className="px-4 py-12 text-center text-muted-foreground text-xs">
                    {loading ? "Loading…" : "No products — click 'Load from Shopify' to fetch listings."}
                  </td>
                </tr>
              )}
              {sortedRows.map((row) => {
                const data = JSON.parse(row.data_json);
                const edit = row.edited_json ? JSON.parse(row.edited_json) : null;
                const display = edit ?? data;
                const displayV = display.variants?.[0] ?? {};
                const isSelected = selected.has(row.id);
                const isOpen = editingProduct?.id === row.id;
                const thumb = data.images?.[0]?.src ?? null;
                const tags = Array.isArray(display.tags)
                  ? display.tags.slice(0, 3).join(", ")
                  : String(display.tags ?? "").split(",").slice(0, 3).join(", ");

                return (
                  <tr
                    key={row.id}
                    className={`border-b transition-colors hover:bg-muted/20 cursor-pointer ${isOpen ? "bg-primary/5" : ""} ${isSelected ? "bg-primary/5" : ""}`}
                    onClick={() => { if (!editingCell) setEditingProduct(isOpen ? null : row); }}
                  >
                    {/* Checkbox */}
                    <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => toggleSelect(row.id)}>
                        {isSelected ? <CheckSquare className="h-3.5 w-3.5 text-primary" /> : <Square className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                    </td>

                    {/* Thumbnail */}
                    <td className="px-1 py-1">
                      {thumb ? <img src={thumb} alt="" className="h-8 w-8 object-cover rounded shrink-0" /> : <div className="h-8 w-8 bg-muted rounded shrink-0" />}
                    </td>

                    {/* Title */}
                    <td className="px-2 py-1.5 font-medium max-w-[200px] truncate" title={display.title}>{display.title}</td>

                    {/* Vendor */}
                    <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{display.vendor}</td>

                    {/* Status — inline select */}
                    <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                      {isEditing(row.id, "status") ? (
                        <select
                          autoFocus
                          value={cellDraft}
                          onChange={(e) => setCellDraft(e.target.value)}
                          onBlur={() => commitCellEdit(row, "status", cellDraft)}
                          onKeyDown={(e) => cellKeyDown(e, row, "status")}
                          className="text-xs border rounded px-1 py-0.5 bg-background w-24"
                        >
                          <option value="active">active</option>
                          <option value="draft">draft</option>
                          <option value="archived">archived</option>
                        </select>
                      ) : (
                        <Badge
                          variant="outline"
                          className={`text-[10px] cursor-pointer hover:opacity-80 ${STATUS_COLORS[display.status] ?? "text-muted-foreground"}`}
                          onClick={(e) => startEdit(e, row, "status", display.status)}
                        >
                          {display.status}
                        </Badge>
                      )}
                    </td>

                    {/* Price */}
                    <td className={`${inlineTdCls} text-right`} onClick={(e) => e.stopPropagation()}>
                      {isEditing(row.id, "price") ? (
                        <input
                          autoFocus type="number" step="0.01" min="0"
                          value={cellDraft}
                          onChange={(e) => setCellDraft(e.target.value)}
                          onBlur={() => commitCellEdit(row, "price", cellDraft)}
                          onKeyDown={(e) => cellKeyDown(e, row, "price")}
                          className={`${inlineInputCls} text-right w-20`}
                        />
                      ) : (
                        <span className={`${editableCellCls} tabular-nums`} onClick={(e) => startEdit(e, row, "price", displayV.price ?? "")}>
                          {fmt.price(displayV.price)}
                        </span>
                      )}
                    </td>

                    {/* Cost (local DB) */}
                    <td className={`${inlineTdCls} text-right`} onClick={(e) => e.stopPropagation()}>
                      {isEditing(row.id, "cost") ? (
                        <input
                          autoFocus type="number" step="0.01" min="0"
                          value={cellDraft}
                          onChange={(e) => setCellDraft(e.target.value)}
                          onBlur={() => commitCellEdit(row, "cost", cellDraft)}
                          onKeyDown={(e) => cellKeyDown(e, row, "cost")}
                          className={`${inlineInputCls} text-right w-20`}
                        />
                      ) : (
                        <span className={`${editableCellCls} tabular-nums text-muted-foreground`} onClick={(e) => startEdit(e, row, "cost", String(row._cost_price ?? ""))}>
                          {fmt.price(row._cost_price)}
                        </span>
                      )}
                    </td>

                    {/* GP% — read only */}
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmt.pct(row._gross_profit_percent)}</td>

                    {/* SOH — from Shopify inventory_quantity */}
                    <td className={`${inlineTdCls} text-right`} onClick={(e) => e.stopPropagation()}>
                      {isEditing(row.id, "inventory_quantity") ? (
                        <input
                          autoFocus type="number" step="1" min="0"
                          value={cellDraft}
                          onChange={(e) => setCellDraft(e.target.value)}
                          onBlur={() => commitCellEdit(row, "inventory_quantity", cellDraft)}
                          onKeyDown={(e) => cellKeyDown(e, row, "inventory_quantity")}
                          className={`${inlineInputCls} text-right w-16`}
                        />
                      ) : (
                        <span className={`${editableCellCls} tabular-nums`} onClick={(e) => startEdit(e, row, "inventory_quantity", String(displayV.inventory_quantity ?? row._stock_on_hand ?? ""))}>
                          {fmt.int(displayV.inventory_quantity ?? row._stock_on_hand)}
                        </span>
                      )}
                    </td>

                    {/* Sold 12m — read only */}
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmt.int(row._units_sold_12m)}</td>

                    {/* Barcode */}
                    <td className={inlineTdCls} onClick={(e) => e.stopPropagation()}>
                      {isEditing(row.id, "barcode") ? (
                        <input
                          autoFocus type="text"
                          value={cellDraft}
                          onChange={(e) => setCellDraft(e.target.value)}
                          onBlur={() => commitCellEdit(row, "barcode", cellDraft)}
                          onKeyDown={(e) => cellKeyDown(e, row, "barcode")}
                          className={`${inlineInputCls} font-mono w-32`}
                        />
                      ) : (
                        <span className={`${editableCellCls} font-mono text-[11px] text-muted-foreground`} onClick={(e) => startEdit(e, row, "barcode", displayV.barcode ?? "")}>
                          {displayV.barcode || "—"}
                        </span>
                      )}
                    </td>

                    {/* Category (product_type) */}
                    <td className={inlineTdCls} onClick={(e) => e.stopPropagation()}>
                      {isEditing(row.id, "product_type") ? (
                        <input
                          autoFocus type="text"
                          value={cellDraft}
                          onChange={(e) => setCellDraft(e.target.value)}
                          onBlur={() => commitCellEdit(row, "product_type", cellDraft)}
                          onKeyDown={(e) => cellKeyDown(e, row, "product_type")}
                          className={`${inlineInputCls} w-36`}
                        />
                      ) : (
                        <span className={`${editableCellCls} text-muted-foreground`} onClick={(e) => startEdit(e, row, "product_type", display.product_type ?? "")}>
                          {display.product_type || "—"}
                        </span>
                      )}
                    </td>

                    {/* Tags — read only */}
                    <td className="px-2 py-1.5 text-muted-foreground max-w-[150px] truncate" title={tags}>{tags}</td>

                    {/* Edits badge */}
                    <td className="px-2 py-1.5">
                      {row.has_edits ? <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-400">Edited</Badge> : null}
                    </td>

                    {/* Edit (open panel) button */}
                    <td className="px-2 py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <button className="p-1 rounded hover:bg-accent" onClick={() => setEditingProduct(isOpen ? null : row)} title="Open editor">
                        <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="shrink-0 border-t bg-background px-4 py-2 flex items-center gap-2 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
            <span className="text-xs font-medium text-muted-foreground">{selected.size} selected</span>
            <Button size="sm" variant="outline" className="gap-1.5 h-7 text-amber-600 border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950" disabled={bulkWorking} onClick={() => handleBulk({ status: "draft" }, "Deactivated")}>
              <EyeOff className="h-3.5 w-3.5" /> Deactivate
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 h-7 text-muted-foreground" disabled={bulkWorking} onClick={() => handleBulk({ status: "archived" }, "Archived")}>
              <ArchiveX className="h-3.5 w-3.5" /> Archive
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 h-7 text-green-600 border-green-400 hover:bg-green-50" disabled={bulkWorking} onClick={() => handleBulk({ status: "active" }, "Activated")}>
              Set Active
            </Button>
            {bulkWorking && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            <button className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1" onClick={() => setSelected(new Set())}>
              <X className="h-3 w-3" /> Clear
            </button>
          </div>
        )}
      </div>

      {/* ── Side edit panel — fixed, independent scroll ───────────────────── */}
      {editingProduct && (
        <div className="w-[460px] shrink-0 border-l flex flex-col overflow-hidden bg-background">
          <ProductEditPanel
            key={editingProduct.id}
            product={editingProduct}
            onClose={() => setEditingProduct(null)}
            onSaved={handleProductSaved}
          />
        </div>
      )}
    </div>
  );
}
