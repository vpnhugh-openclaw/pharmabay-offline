import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MergeDialog } from "@/components/shopify/listings/MergeDialog";
import { ScanSearch, Loader2, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";

interface DupGroup {
  confidence: "high" | "medium";
  reason: string;
  items: any[];
}

export function ShopifyDuplicates() {
  const [groups, setGroups]     = useState<DupGroup[]>([]);
  const [running, setRunning]   = useState(false);
  const [ran, setRan]           = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [merging, setMerging]   = useState<{ group: DupGroup; pair: [any, any] } | null>(null);

  const runCheck = async () => {
    setRunning(true); setError(null);
    try {
      const res = await window.electronAPI.shopifyFindDuplicates();
      if (res.error) { setError(res.error); return; }
      const all = res.data?.groups ?? [];
      setGroups(all);
      setExpanded(new Set(all.map((_: any, i: number) => i))); // expand all by default
      setRan(true);
    } finally {
      setRunning(false);
    }
  };

  const toggleExpand = (i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const handleMerged = async () => {
    setMerging(null);
    // Re-run the check to refresh groups
    await runCheck();
  };

  const confidenceBadge = (c: "high" | "medium") =>
    c === "high"
      ? <Badge className="text-[10px] bg-red-600 text-white">High confidence</Badge>
      : <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600">Medium confidence</Badge>;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b px-6 py-3 flex items-center gap-3 bg-muted/10">
        <ScanSearch className="h-5 w-5 text-muted-foreground" />
        <div>
          <h2 className="text-sm font-semibold">Duplicates Checker</h2>
          <p className="text-xs text-muted-foreground">Detects listings with matching barcodes, SKUs, or very similar titles</p>
        </div>
        <Button size="sm" onClick={runCheck} disabled={running} className="ml-auto gap-1.5">
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanSearch className="h-3.5 w-3.5" />}
          {running ? "Scanning…" : ran ? "Re-scan" : "Scan for Duplicates"}
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded px-4 py-3 mb-4">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {!ran && !running && (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
            <ScanSearch className="h-12 w-12 opacity-20" />
            <p className="text-sm">Press "Scan for Duplicates" to analyse your Shopify listings.</p>
            <p className="text-xs opacity-60">Checks for matching barcodes, SKUs, and similar product titles within the same vendor.</p>
          </div>
        )}

        {ran && !running && groups.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 text-green-500 opacity-60" />
            <p className="text-sm font-medium">No duplicates found!</p>
            <p className="text-xs opacity-60">All listings appear to be unique.</p>
          </div>
        )}

        {groups.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Found <strong>{groups.length}</strong> suspected duplicate group{groups.length !== 1 ? "s" : ""}
              {" — "}
              <span className="text-red-600">{groups.filter((g) => g.confidence === "high").length} high confidence</span>
              {", "}
              <span className="text-amber-600">{groups.filter((g) => g.confidence === "medium").length} medium confidence</span>
            </p>

            {groups.map((group, gi) => {
              const isExpanded = expanded.has(gi);
              return (
                <div key={gi} className="border rounded-lg overflow-hidden">
                  {/* Group header */}
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2.5 bg-muted/30 hover:bg-muted/50 text-left transition-colors"
                    onClick={() => toggleExpand(gi)}
                  >
                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                    {confidenceBadge(group.confidence)}
                    <span className="text-xs text-muted-foreground">{group.reason}</span>
                    <span className="ml-auto text-xs text-muted-foreground shrink-0">{group.items.length} listings</span>
                  </button>

                  {/* Expanded: show each pair */}
                  {isExpanded && (
                    <div className="divide-y">
                      {/* Pairwise combinations */}
                      {group.items.flatMap((itemA: any, ai: number) =>
                        group.items.slice(ai + 1).map((itemB: any, bi: number) => {
                          const dataA = JSON.parse(itemA.data_json);
                          const dataB = JSON.parse(itemB.data_json);
                          const vA = dataA.variants?.[0] ?? {};
                          const vB = dataB.variants?.[0] ?? {};
                          const thumbA = dataA.images?.[0]?.src;
                          const thumbB = dataB.images?.[0]?.src;

                          return (
                            <div key={`${ai}-${bi}`} className="px-4 py-3 flex items-center gap-3">
                              {/* Product A */}
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {thumbA
                                  ? <img src={thumbA} alt="" className="h-10 w-10 object-cover rounded shrink-0" />
                                  : <div className="h-10 w-10 bg-muted rounded shrink-0" />}
                                <div className="min-w-0">
                                  <p className="text-xs font-medium truncate">{dataA.title}</p>
                                  <p className="text-[10px] text-muted-foreground">{dataA.vendor} · {vA.barcode || vA.sku || "no barcode/SKU"} · ${vA.price}</p>
                                  <Badge variant="outline" className={`text-[10px] mt-0.5 ${dataA.status === "active" ? "text-green-600 border-green-400" : "text-amber-600 border-amber-400"}`}>{dataA.status}</Badge>
                                </div>
                              </div>

                              <span className="text-muted-foreground text-xs shrink-0">vs</span>

                              {/* Product B */}
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {thumbB
                                  ? <img src={thumbB} alt="" className="h-10 w-10 object-cover rounded shrink-0" />
                                  : <div className="h-10 w-10 bg-muted rounded shrink-0" />}
                                <div className="min-w-0">
                                  <p className="text-xs font-medium truncate">{dataB.title}</p>
                                  <p className="text-[10px] text-muted-foreground">{dataB.vendor} · {vB.barcode || vB.sku || "no barcode/SKU"} · ${vB.price}</p>
                                  <Badge variant="outline" className={`text-[10px] mt-0.5 ${dataB.status === "active" ? "text-green-600 border-green-400" : "text-amber-600 border-amber-400"}`}>{dataB.status}</Badge>
                                </div>
                              </div>

                              {/* Merge button */}
                              <Button
                                size="sm"
                                variant="outline"
                                className="shrink-0 h-7 text-xs gap-1"
                                onClick={() => setMerging({ group, pair: [itemA, itemB] })}
                              >
                                Review &amp; Merge
                              </Button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Merge dialog overlay */}
      {merging && (
        <MergeDialog
          products={merging.pair}
          reason={merging.group.reason}
          onClose={() => setMerging(null)}
          onMerged={handleMerged}
        />
      )}
    </div>
  );
}
