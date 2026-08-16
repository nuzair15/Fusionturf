import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Calendar, Trophy, Activity, GitCompare,
  Users, Medal, MapPin, Handshake, Newspaper, BarChart3,
  Shield, Settings, ChevronDown, X, LogOut, CheckCircle2,
  Image, Ticket, Monitor, CircleHelp, MessageSquare,
} from "lucide-react";

interface NavItem {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  { items: [{ id: "overview", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "OPERATIONS",
    items: [
      { id: "bookings", label: "Bookings", icon: Calendar },
      { id: "calendar", label: "Calendar", icon: MapPin },
      { id: "analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "FOOTBALL",
    items: [
      { id: "seasons", label: "League", icon: Trophy },
      { id: "competitions", label: "Competitions", icon: Trophy },
      { id: "fixtures", label: "Fixtures", icon: Activity },
      { id: "teams", label: "Teams", icon: Users },
      { id: "players", label: "Players", icon: Users },
      { id: "player-stats", label: "Player Stats", icon: BarChart3 },
      { id: "awards", label: "Awards", icon: Medal },
      { id: "suspensions", label: "Suspensions", icon: Shield },
    ],
  },
  {
    label: "CONTENT & BUSINESS",
    items: [
      { id: "venues", label: "Venues", icon: MapPin },
      { id: "gallery", label: "Gallery", icon: Image },
      { id: "sponsors", label: "Sponsors", icon: Handshake },
      { id: "news", label: "News", icon: Newspaper },
      { id: "coupons", label: "Coupons", icon: Ticket },
      { id: "ads", label: "Ads", icon: Monitor },
      { id: "faqs", label: "FAQs", icon: CircleHelp },
      { id: "reviews", label: "Reviews", icon: MessageSquare },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { id: "activity", label: "Activity", icon: GitCompare },
      { id: "users", label: "Users", icon: Shield },
      { id: "settings", label: "Settings", icon: Settings },
    ],
  },
];

const allIds = navGroups.flatMap((g) => g.items.map((i) => i.id));

interface AdminSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  onClose?: () => void;
}

export function AdminSidebar({ activeTab, onTabChange, onLogout, onClose }: AdminSidebarProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (label: string | undefined) => {
    if (!label) return;
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <aside className="flex h-full flex-col bg-card/95 backdrop-blur">
      <div className="flex items-center justify-between border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Fusion" className="h-8 w-auto" />
          <span className="text-sm font-semibold tracking-tight">Admin Panel</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary lg:hidden">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => {
          const isCollapsible = !!group.label;
          const isOpen = !group.label || !collapsedGroups.has(group.label);

          return (
            <div key={group.label || "dashboard"} className="mb-1">
              {group.label && (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="flex w-full items-center gap-1.5 px-2 py-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60"
                >
                  <ChevronDown className={cn("h-3 w-3 transition-transform", isOpen && "rotate-0", !isOpen && "-rotate-90")} />
                  {group.label}
                </button>
              )}
              <AnimatePresence initial={false}>
                {(isOpen || !isCollapsible) && (
                  <motion.div
                    key={group.label || "main"}
                    initial={isCollapsible ? { height: 0, opacity: 0 } : false}
                    animate={isCollapsible ? { height: "auto", opacity: 1 } : undefined}
                    exit={isCollapsible ? { height: 0, opacity: 0 } : undefined}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    {group.items.map((item) => {
                      const isActive = activeTab === item.id || (item.id === "overview" && activeTab === "overview");
                      return (
                        <button
                          key={item.id}
                          onClick={() => { onTabChange(item.id); onClose?.(); }}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                            isActive
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <div className="mb-2 flex items-center gap-2 px-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs text-muted-foreground">Admin</span>
        </div>
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

export function SidebarDrawer({ children, open, onClose }: { children: React.ReactNode; open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          />
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 250 }}
            className="fixed inset-y-0 left-0 z-50 w-72 border-r bg-background shadow-xl lg:hidden"
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
