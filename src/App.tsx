import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter as BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import ScanSearch from "./pages/ScanSearch";
import Products from "./pages/Products";
import ReviewQueue from "./pages/ReviewQueue";
import ExportBuilder from "./pages/ExportBuilder";
import ExportHistory from "./pages/ExportHistory";
import ImportStock from "./pages/ImportStock";
import ChannelSync from "./pages/ChannelSync";
import Settings from "./pages/Settings";
import AuditLog from "./pages/AuditLog";
import ProductEditor from "./pages/ProductEditor";
import ShopifyReconciliation from "./pages/ShopifyReconciliation";
import ShopifyStockSync from "./pages/ShopifyStockSync";
import ReconciliationReport from "./pages/ReconciliationReport";
import ChannelListingImports from "./pages/ChannelListingImports";
import EbayCallback from "./pages/EbayCallback";
import MarketResearch from "./pages/MarketResearch";
import { ShopifyListings } from "./pages/ShopifyListings";
import { ShopifyDuplicates } from "./pages/ShopifyDuplicates";
import Auth from "./pages/Auth";
import Exports from "./pages/Exports";
import ScrapeProducts from "./pages/ScrapeProducts";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<ScanSearch />} />
              <Route path="/products" element={<Products />} />
              <Route path="/products/:id" element={<ProductEditor />} />
              <Route path="/review" element={<ReviewQueue />} />
              <Route path="/exports" element={<Exports />} />
              <Route path="/exports/new" element={<ExportBuilder />} />
              <Route path="/exports/history" element={<ExportHistory />} />
              <Route path="/import" element={<ImportStock />} />
              <Route path="/sync" element={<ChannelSync />} />
              <Route path="/reconciliation" element={<ShopifyReconciliation />} />
              <Route path="/recon-report" element={<ReconciliationReport />} />
              <Route path="/stock-sync" element={<ShopifyStockSync />} />
              <Route path="/channel-imports" element={<ChannelListingImports />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/ebay-callback" element={<EbayCallback />} />
              <Route path="/ebay/callback" element={<EbayCallback />} />
              <Route path="/audit" element={<AuditLog />} />
              <Route path="/market-research" element={<MarketResearch />} />
              <Route path="/scrape" element={<ScrapeProducts />} />
              <Route path="/shopify-listings" element={<ShopifyListings />} />
              <Route path="/shopify-duplicates" element={<ShopifyDuplicates />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
