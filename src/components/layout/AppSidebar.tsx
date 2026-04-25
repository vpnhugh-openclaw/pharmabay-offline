import {
  Scan,
  Package,
  AlertTriangle,
  Download,
  Upload,
  RefreshCw,
  Settings,
  FileText,
  LogOut,
  ArrowLeftRight,
  ArrowUpDown,
  FileDown,
  Sparkles,
  Globe,
  LayoutList,
  ScanSearch,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const navItems = [
  { title: "Scan / Search", url: "/", icon: Scan },
  { title: "Products", url: "/products", icon: Package },
  { title: "Review Queue", url: "/review", icon: AlertTriangle },
  { title: "Export History", url: "/exports", icon: Download },
  { title: "Import Stock", url: "/import", icon: Upload },
  { title: "Channel Sync", url: "/sync", icon: RefreshCw },
  { title: "Reconciliation", url: "/reconciliation", icon: ArrowLeftRight },
  { title: "Recon Report", url: "/recon-report", icon: FileText },
  { title: "Stock Sync", url: "/stock-sync", icon: ArrowUpDown },
  { title: "Shopify Listings", url: "/shopify-listings", icon: LayoutList },
  { title: "Duplicates Checker", url: "/shopify-duplicates", icon: ScanSearch },
  { title: "Channel Imports", url: "/channel-imports", icon: FileDown },
  { title: "Market Research", url: "/market-research", icon: Sparkles },
  { title: "Scrape Products", url: "/scrape", icon: Globe },
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Audit Log", url: "/audit", icon: FileText },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, user } = useAuth();

  const handleLogout = async () => {
    await signOut();
    toast.success("Signed out");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary/20">
            <Package className="h-5 w-5 text-sidebar-primary" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-display text-sidebar-accent-foreground tracking-tight">
                PharmaBay
              </span>
              <span className="text-[10px] text-sidebar-foreground/60 uppercase tracking-[0.2em] font-sans font-medium">
                Lister
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground/70 text-[10px] uppercase tracking-widest">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent/60 rounded-lg transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 space-y-2">
        {!collapsed && user && (
          <div className="text-[10px] text-muted-foreground/60 truncate px-1">
            {user.email}
          </div>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 rounded-lg"
          onClick={handleLogout}
        >
          <LogOut className={`h-4 w-4 ${collapsed ? "" : "mr-2"}`} />
          {!collapsed && <span>Sign Out</span>}
        </Button>
        {!collapsed && (
          <div className="text-[10px] text-muted-foreground/40 text-center">
            PharmaBay Lister v1.0
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
