import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/useIsMobile";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { formatDate, formatCurrency } from "@/lib/utils";
import { buildBookingMessage } from "@/lib/bookingMessage";
import { MatchControlCenter } from "@/components/live/MatchControlCenter";
import { LineupEditor } from "@/components/admin/LineupEditor";
import { AdminSidebar, SidebarDrawer } from "@/components/admin/AdminSidebar";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { AdminCalendar } from "@/components/admin/AdminCalendar";
import { AdminAnalytics } from "@/components/admin/AdminAnalytics";
import { BookingDrawer } from "@/components/admin/BookingDrawer";
import { BottomSheet } from "@/components/admin/BottomSheet";
import { DataTable, ColumnDef, BulkAction } from "@/components/admin/DataTable";
import type { DashboardStats, User, Season, Team, Player, Fixture, Award, News, Booking, PaginatedResponse, Venue, Turf, Sponsor, Suspension, ActivityLog, Gallery, Coupon, Advertisement, Faq, ReviewAdmin } from "@/types";
import { LayoutDashboard, Users, Calendar, CalendarDays, Trophy, Settings, Activity, LogOut, ChevronLeft, Plus, Edit2, Trash2, Medal, Newspaper, DollarSign, Image, Lock, MapPin, Handshake, Upload, CheckCircle2, XCircle, ListChecks, AlertTriangle, MessageSquare, HelpCircle, Tag, Monitor, Search, Menu, TrendingUp, MoreHorizontal, MessageCircle, QrCode, Copy } from "lucide-react";
import { VenueCalendar } from "@/components/admin/VenueCalendar";
import { ImageUpload } from "@/components/admin/ImageUpload";

const adminTabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "seasons", label: "Seasons", icon: Calendar },
  { id: "teams", label: "Teams", icon: Trophy },
  { id: "players", label: "Players", icon: Users },
  { id: "player-stats", label: "Player Stats", icon: TrendingUp },
  { id: "fixtures", label: "Fixtures", icon: Activity },
  { id: "awards", label: "Awards", icon: Medal },
  { id: "gallery", label: "Gallery", icon: Image },
  { id: "venues", label: "Venues", icon: MapPin },
  { id: "bookings", label: "Bookings", icon: Calendar },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "analytics", label: "Analytics", icon: TrendingUp },
  { id: "news", label: "News", icon: Newspaper },
  { id: "sponsors", label: "Sponsors", icon: Handshake },
  { id: "coupons", label: "Coupons", icon: Tag },
  { id: "ads", label: "Ads", icon: Monitor },
  { id: "faqs", label: "FAQs", icon: HelpCircle },
  { id: "reviews", label: "Reviews", icon: MessageSquare },
  { id: "suspensions", label: "Suspensions", icon: AlertTriangle },
  { id: "activity", label: "Activity Logs", icon: ListChecks },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "users", label: "Users", icon: Users },
];

export function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showForm, setShowForm] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [unlocked, setUnlocked] = useState(() => !!sessionStorage.getItem("admin_token"));

  // Form state for modals
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<string>("");
  const [actionError, setActionError] = useState<string>("");
  const [fixtureOptions, setFixtureOptions] = useState({ teamCount: 6, leagueWeeks: 7, matchesPerPair: 2, startDate: "", fixtureDays: ["Friday", "Saturday", "Sunday"] as string[] });
  const [generating, setGenerating] = useState(false);
  const [liveStatsFixtureId, setLiveStatsFixtureId] = useState<string | null>(null);
  const [lineupFixture, setLineupFixture] = useState<Fixture | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [winnerSearchTerm, setWinnerSearchTerm] = useState("");
  const [winnerResults, setWinnerResults] = useState<any[]>([]);
  const [winnerLoading, setWinnerLoading] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<any>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [copiedBookingId, setCopiedBookingId] = useState<string | null>(null);
  const [teamSearch, setTeamSearch] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [fixtureSearch, setFixtureSearch] = useState("");
  const [bookingSearch, setBookingSearch] = useState("");
  const [newsSearch, setNewsSearch] = useState("");
  const [sponsorSearch, setSponsorSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [friendlyStatsMode, setFriendlyStatsMode] = useState(false);

  const openForm = (type: string, initial: Record<string, any> = {}) => {
    setFormData(initial);
    setFormErrors("");
    setShowForm(type);
  };

  const handleFormChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const slugify = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const getSubmitPayload = (type: string) => {
    const payload = { ...formData };

    if (["season", "team", "player", "award", "venue"].includes(type) && !payload.slug) {
      const source = type === "player"
        ? `${payload.firstName || ""} ${payload.lastName || ""}`
        : payload.name || payload.title || "";
      payload.slug = slugify(source) || `${type}-${Date.now()}`;
    }

    if (type === "venue") {
      payload.address = payload.address || "Address to be updated";
      payload.city = payload.city || "City";
      payload.state = payload.state || "State";
    }

    return payload;
  };

  const submitForm = async (type: string, url: string, invalidateKey: string) => {
    try {
      setFormErrors("");
      if (editingItem) {
        await api.patch(`${url}/${editingItem.id}`, getSubmitPayload(type));
      } else {
        await api.post(url, getSubmitPayload(type));
      }
      setEditingItem(null);
      setShowForm(null);
      queryClient.invalidateQueries({ queryKey: [invalidateKey] });
    } catch (err: any) {
      setFormErrors(err.message || "Failed to save");
    }
  };

  const handleUnlock = async () => {
    try {
      await api.adminLogin(passwordInput);
      setUnlocked(true);
      setPasswordError(false);
    } catch {
      setPasswordError(true);
    }
  };

  const tabEnabled = (...tabs: string[]) => unlocked && tabs.includes(activeTab);

  const { data: dashboard, isLoading: dashboardLoading } = useQuery({ queryKey: ["admin-dashboard"], queryFn: () => api.get<DashboardStats>("/admin/dashboard"), enabled: tabEnabled("overview"), retry: 1, staleTime: 30000 });

  const { data: users } = useQuery({ queryKey: ["admin-users", userSearch], queryFn: () => api.get<{ data: User[] }>("/admin/users", { limit: "100", ...(userSearch ? { search: userSearch } : {}) }), enabled: tabEnabled("users") });

  const { data: seasons } = useQuery({ queryKey: ["admin-seasons"], queryFn: () => api.get<Season[]>("/admin/seasons"), enabled: unlocked });

  const currentSeason = (seasons || []).find((s: Season) => s.isCurrent);

  const handleSearchOpen = useCallback(() => setSearchOpen(true), []);
  const handleSearchClose = useCallback(() => setSearchOpen(false), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Default selected season to current season when seasons load
  useEffect(() => {
    if (currentSeason && !selectedSeasonId) {
      setSelectedSeasonId(currentSeason.id);
    }
  }, [currentSeason?.id]);

  const { data: teams } = useQuery({
    queryKey: ["admin-teams", selectedSeasonId, teamSearch],
    queryFn: () => api.get<Team[]>("/admin/teams", { ...(selectedSeasonId ? { seasonId: selectedSeasonId } : {}), ...(teamSearch ? { search: teamSearch } : {}) }),
    enabled: tabEnabled("teams", "players", "fixtures"),
  });

  const { data: players } = useQuery({
    queryKey: ["admin-players", selectedSeasonId, playerSearch],
    queryFn: () => api.get<PaginatedResponse<Player>>("/admin/players", { limit: "100", ...(selectedSeasonId ? { seasonId: selectedSeasonId } : {}), ...(playerSearch ? { search: playerSearch } : {}) }),
    enabled: tabEnabled("players"),
  });

  const { data: editablePlayerStats } = useQuery({
    queryKey: ["admin-player-stats", selectedSeasonId, friendlyStatsMode],
    queryFn: () => api.get<any[]>("/admin/player-stats", { seasonId: selectedSeasonId, friendly: friendlyStatsMode ? "true" : "false" }),
    enabled: tabEnabled("player-stats") && !!selectedSeasonId,
  });

  const { data: fixtures } = useQuery({ queryKey: ["admin-fixtures", fixtureSearch], queryFn: () => api.get<PaginatedResponse<Fixture>>("/admin/fixtures", { limit: "100", ...(fixtureSearch ? { search: fixtureSearch } : {}) }), enabled: tabEnabled("fixtures") });

  const { data: awards } = useQuery({ queryKey: ["admin-awards"], queryFn: () => api.get<Award[]>("/admin/awards"), enabled: tabEnabled("awards") });

  const { data: bookings } = useQuery({ queryKey: ["admin-bookings", bookingSearch], queryFn: () => api.get<PaginatedResponse<Booking>>("/admin/bookings", { limit: "100", ...(bookingSearch ? { search: bookingSearch } : {}) }), enabled: tabEnabled("bookings") });

  const { data: news } = useQuery({ queryKey: ["admin-news", newsSearch], queryFn: () => api.get<PaginatedResponse<News>>("/admin/news", { limit: "100", ...(newsSearch ? { search: newsSearch } : {}) }), enabled: tabEnabled("news") });

  const { data: venues } = useQuery({ queryKey: ["admin-venues"], queryFn: () => api.get<{ data: Venue[] }>("/admin/venues"), enabled: tabEnabled("venues") });

  const { data: settings } = useQuery({ queryKey: ["admin-settings"], queryFn: () => api.get<Record<string, string>>("/admin/settings"), enabled: unlocked });

  const { data: sponsors } = useQuery({ queryKey: ["admin-sponsors", sponsorSearch], queryFn: () => api.get<{ data: Sponsor[] }>("/admin/sponsors", { ...(sponsorSearch ? { search: sponsorSearch } : {}) }), enabled: tabEnabled("sponsors") });

  const { data: activityLogs } = useQuery({ queryKey: ["admin-activity"], queryFn: () => api.get<PaginatedResponse<ActivityLog>>("/admin/activity-logs", { limit: "50" }), enabled: tabEnabled("activity") });

  const { data: suspensions } = useQuery({ queryKey: ["admin-suspensions"], queryFn: () => api.get<PaginatedResponse<Suspension>>("/admin/suspensions", { limit: "50" }), enabled: tabEnabled("suspensions") });

  const { data: galleryItems } = useQuery({ queryKey: ["admin-gallery"], queryFn: () => api.get<{ data: Gallery[] }>("/admin/gallery"), enabled: tabEnabled("gallery") });

  const { data: coupons } = useQuery({ queryKey: ["admin-coupons"], queryFn: () => api.get<{ data: Coupon[] }>("/admin/coupons"), enabled: tabEnabled("coupons") });

  const { data: ads } = useQuery({ queryKey: ["admin-ads"], queryFn: () => api.get<{ data: Advertisement[] }>("/admin/ads"), enabled: tabEnabled("ads") });

  const { data: faqs } = useQuery({ queryKey: ["admin-faqs"], queryFn: () => api.get<{ data: Faq[] }>("/admin/faqs"), enabled: tabEnabled("faqs") });

  const { data: reviews } = useQuery({ queryKey: ["admin-reviews"], queryFn: () => api.get<{ data: ReviewAdmin[] }>("/admin/reviews"), enabled: tabEnabled("reviews") });

  const stats = dashboard?.stats;

  const handleLogout = () => {
    api.setAdminToken(null);
    api.logout();
    navigate("/");
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.14),transparent_34%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--secondary)/0.45))]">
        <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-20">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full rounded-2xl border bg-card/95 p-6 text-center shadow-xl backdrop-blur">
            <img src="/logo.png" alt="Fusion" className="mx-auto mb-6 h-16 w-auto" />
            <h1 className="text-2xl font-bold">Admin Access</h1>
            <p className="mt-2 text-muted-foreground">Enter the admin password to unlock dashboard actions.</p>
            <form
              onSubmit={(e) => { e.preventDefault(); handleUnlock(); }}
              className="mt-6 space-y-4"
            >
              <Input
                type="password"
                placeholder="Enter password"
                value={passwordInput}
                onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
                className={passwordError ? "border-destructive" : ""}
                autoFocus
              />
              {passwordError && (
                <p className="text-sm text-destructive">Wrong admin password.</p>
              )}
              <Button type="submit" className="w-full bg-gradient-to-r from-[#0f5f44] to-[#00d66f] text-white">
                <Lock className="mr-2 h-4 w-4" /> Unlock
              </Button>
            </form>
            <Button variant="ghost" className="mt-4" onClick={() => navigate("/")}>Back to Home</Button>
          </motion.div>
        </div>
      </div>
    );
  }

  const activeTabLabel = adminTabs.find((t) => t.id === activeTab)?.label || "Dashboard";

  return (
    <div className="flex min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_34%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--secondary)/0.45))]">
      {/* Desktop Sidebar */}
      <div className="hidden w-64 shrink-0 border-r bg-card/80 backdrop-blur lg:block">
        <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} onLogout={handleLogout} />
      </div>

      {/* Mobile Drawer */}
      <SidebarDrawer open={sidebarOpen} onClose={() => setSidebarOpen(false)}>
        <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} onLogout={handleLogout} onClose={() => setSidebarOpen(false)} />
      </SidebarDrawer>

      {/* Search Modal */}
      <AnimatePresence>
        {searchOpen && <AdminSearch onClose={handleSearchClose} />}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-lg font-bold tracking-tight">{activeTabLabel}</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">Manage venues, teams, content, and bookings</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={handleSearchOpen}>
                <Search className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Search</span>
                <kbd className="hidden rounded border bg-muted px-1 text-[10px] font-medium text-muted-foreground sm:inline">Ctrl+K</kbd>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1 text-xs">
                <ChevronLeft className="h-3.5 w-3.5" /> Site
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {activeTab === "overview" && <AdminDashboard />}

        {activeTab === "seasons" && (
          <>
          {!seasons ? <TabSkeleton /> : (<>
            <AdminTable
              title="Seasons"
              columns={["Name", "Start Date", "End Date", "Status", "Teams", "Players", "Fixtures"]}
              data={seasons || []}
              renderRow={(s: Season) => [
                <span className="font-medium">{s.name}</span>,
                formatDate(s.startDate),
                formatDate(s.endDate),
                <div className="flex gap-1">
                  {s.isCurrent && <Badge className="bg-primary">Current</Badge>}
                  {s.isActive ? <Badge variant="default">Active</Badge> : <Badge variant="destructive">Inactive</Badge>}
                  {s.transferWindowOpen && <Badge variant="outline" className="border-green-500 text-green-600">Transfer Window Open</Badge>}
                </div>,
                s._count?.teams || 0,
                s._count?.players || 0,
                s._count?.fixtures || 0,
              ]}
              onAdd={() => { setEditingItem(null); openForm("season", { name: "", isActive: true, isCurrent: false }); }}
              onEdit={(s) => { setEditingItem(s); openForm("season", { name: s.name, slug: s.slug, startDate: s.startDate, endDate: s.endDate, isActive: s.isActive, isCurrent: s.isCurrent }); }}
            />
              <div className="mb-4 rounded-2xl border bg-card p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">League System Actions</h3>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={async () => {
                  const s = (seasons || []).find((s: Season) => s.isCurrent);
                  if (!s) return setActionError("No current season selected");
                  setFixtureOptions({ teamCount: 6, leagueWeeks: 7, matchesPerPair: 2, startDate: s.startDate?.split("T")[0] || "", fixtureDays: ["Friday", "Saturday", "Sunday"] });
                  setShowForm("generateFixtures");
                }}>Bulk Generate Fixtures</Button>
                <Button size="sm" variant="outline" onClick={async () => {
                  const s = (seasons || []).find((s: Season) => s.isCurrent);
                  if (!s) return setActionError("No current season selected");
                  try { setActionError(""); await api.post(`/admin/seasons/${s.id}/postseason`, {}); queryClient.invalidateQueries({ queryKey: ["admin-seasons"] }); } catch (e: any) { setActionError(e.message); }
                }}>Generate Post-Season</Button>
                <Button size="sm" variant="outline" onClick={async () => {
                  const s = (seasons || []).find((s: Season) => s.isCurrent);
                  if (!s) return setActionError("No current season selected");
                  try { setActionError(""); await api.post(`/admin/seasons/${s.id}/transfer-window/open`, {}); queryClient.invalidateQueries({ queryKey: ["admin-seasons"] }); } catch (e: any) { setActionError(e.message); }
                }}>Open Transfer Window</Button>
                <Button size="sm" variant="outline" onClick={async () => {
                  const s = (seasons || []).find((s: Season) => s.isCurrent);
                  if (!s) return setActionError("No current season selected");
                  try { setActionError(""); await api.post(`/admin/seasons/${s.id}/transfer-window/close`, {}); queryClient.invalidateQueries({ queryKey: ["admin-seasons"] }); } catch (e: any) { setActionError(e.message); }
                }}>Close Transfer Window</Button>
                <Button size="sm" variant="default" onClick={async () => {
                  const s = (seasons || []).find((s: Season) => s.isCurrent);
                  if (!s) return setActionError("No current season selected");
                  const name = prompt("New season name (e.g. April – June 2026):");
                  if (!name) return;
                  try { setActionError(""); await api.post(`/admin/seasons/${s.id}/create-next`, { name, startDate: new Date().toISOString(), endDate: new Date(Date.now() + 120 * 86400000).toISOString() }); queryClient.invalidateQueries({ queryKey: ["admin-seasons"] }); } catch (e: any) { setActionError(e.message); }
                }}>Create Next Season</Button>
              </div>
              {actionError && <p className="mt-2 text-sm text-destructive">{actionError}</p>}
            </div>
            <Dialog open={showForm === "season"} onClose={() => { setShowForm(null); setEditingItem(null); }} title={editingItem ? "Edit Season" : "Add Season"}>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Season Name</Label>
                  <Input value={formData.name || ""} onChange={(e) => handleFormChange("name", e.target.value)} placeholder="e.g. January – March 2026" />
                </div>
                <div className="space-y-1.5">
                  <Label>Start Date</Label>
                  <Input type="date" value={formData.startDate?.split("T")[0] || ""} onChange={(e) => handleFormChange("startDate", new Date(e.target.value).toISOString())} />
                </div>
                <div className="space-y-1.5">
                  <Label>End Date</Label>
                  <Input type="date" value={formData.endDate?.split("T")[0] || ""} onChange={(e) => handleFormChange("endDate", new Date(e.target.value).toISOString())} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={formData.isActive ?? true} onChange={(e) => handleFormChange("isActive", e.target.checked)} className="rounded" />
                  Active
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={formData.isCurrent ?? false} onChange={(e) => handleFormChange("isCurrent", e.target.checked)} className="rounded" />
                  Current Season
                </label>
                {formErrors && <p className="text-sm text-destructive">{formErrors}</p>}
                <Button className="w-full" onClick={() => submitForm("season", "/admin/seasons", "admin-seasons")}
                  disabled={!formData.name || !formData.startDate || !formData.endDate}>{editingItem ? "Update Season" : "Create Season"}</Button>
              </div>
            </Dialog>
            <Dialog open={showForm === "generateFixtures"} onClose={() => { if (!generating) setShowForm(null); }} title="Bulk Generate Fixtures">
              <div className="space-y-4">
                <div>
                  <Label>Number of Teams</Label>
                  <Input type="number" min={2} max={20} value={fixtureOptions.teamCount} onChange={(e) => setFixtureOptions({ ...fixtureOptions, teamCount: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>League Weeks</Label>
                  <Input type="number" min={1} max={52} value={fixtureOptions.leagueWeeks} onChange={(e) => setFixtureOptions({ ...fixtureOptions, leagueWeeks: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Matches Per Pair</Label>
                  <Input type="number" min={1} max={4} value={fixtureOptions.matchesPerPair} onChange={(e) => setFixtureOptions({ ...fixtureOptions, matchesPerPair: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Start Date</Label>
                  <Input type="date" value={fixtureOptions.startDate} onChange={(e) => setFixtureOptions({ ...fixtureOptions, startDate: e.target.value })} />
                </div>
                <div>
                  <Label>Fixture Days (comma separated)</Label>
                  <Input type="text" value={fixtureOptions.fixtureDays.join(", ")} onChange={(e) => setFixtureOptions({ ...fixtureOptions, fixtureDays: e.target.value.split(",").map((d) => d.trim()).filter(Boolean) })} />
                </div>
                {actionError && <p className="text-sm text-destructive">{actionError}</p>}
                <Button className="w-full" disabled={generating} onClick={async () => {
                  const s = (seasons || []).find((s: Season) => s.isCurrent);
                  if (!s) return setActionError("No current season selected");
                  setGenerating(true);
                  try { setActionError(""); await api.post(`/admin/seasons/${s.id}/generate-fixtures`, fixtureOptions); queryClient.invalidateQueries({ queryKey: ["admin-seasons"] }); setShowForm(null); } catch (e: any) { setActionError(e.message); }
                  finally { setGenerating(false); }
                }}>{generating ? "Generating..." : "Generate Fixtures"}</Button>
              </div>
            </Dialog>
              </>
            )}
          </>
        )}

        {activeTab === "teams" && (
          <>
            <DataTable<Team>
              title="Teams"
              columns={[
                { key: "logo", label: "Logo", render: (t) => <img src={t.logoUrl || "/placeholder.svg"} alt="" className="h-8 w-8 rounded-full bg-muted" /> },
                { key: "name", label: "Name", sortable: true, render: (t) => <span className="font-medium">{t.name}</span> },
                { key: "city", label: "City", sortable: true, render: (t) => t.city || "-" },
                { key: "status", label: "Status", render: (t) => <Badge variant={t.status === "active" || !t.status ? "default" : t.status === "relegated" ? "secondary" : "destructive"}>{t.status || "active"}</Badge> },
                { key: "players", label: "Players", render: (t) => t._count?.players || 0 },
                { key: "matches", label: "Matches", render: (t) => t._count?.homeMatches || 0 },
              ]}
              data={teams || []}
              keyExtractor={(t) => t.id}
              onSearch={setTeamSearch}
              onAdd={() => { setEditingItem(null); openForm("team", { name: "", shortName: "", city: "", seasonId: seasons?.[0]?.id || "", status: "active" }); }}
              onEdit={(t) => { setEditingItem(t); openForm("team", { name: t.name, slug: t.slug, shortName: t.shortName || "", city: t.city || "", seasonId: t.seasonId, logoUrl: t.logoUrl || "", status: t.status || "active" }); }}
            />
            <Dialog open={showForm === "team"} onClose={() => { setShowForm(null); setEditingItem(null); }} title={editingItem ? "Edit Team" : "Add Team"}>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Team Name</Label>
                  <Input value={formData.name || ""} onChange={(e) => handleFormChange("name", e.target.value)} placeholder="e.g. FC Phoenix" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Short Name</Label>
                    <Input value={formData.shortName || ""} onChange={(e) => handleFormChange("shortName", e.target.value)} placeholder="e.g. FCP" maxLength={5} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>City</Label>
                    <Input value={formData.city || ""} onChange={(e) => handleFormChange("city", e.target.value)} placeholder="City" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={formData.status || "active"} onChange={(e) => handleFormChange("status", e.target.value)}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="relegated">Relegated</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Season</Label>
                  <Select value={formData.seasonId || ""} onChange={(e) => handleFormChange("seasonId", e.target.value)}>
                    <option value="">Select season...</option>
                    {(seasons || []).map((s: Season) => (
                      <option key={s.id} value={s.id}>{s.name}{s.isCurrent ? " (Current)" : ""}</option>
                    ))}
                  </Select>
                </div>
                <ImageUploadField label="Logo" value={formData.logoUrl || ""} onChange={(value) => handleFormChange("logoUrl", value)} />
                {formErrors && <p className="text-sm text-destructive">{formErrors}</p>}
                <Button className="w-full" onClick={() => submitForm("team", "/admin/teams", "admin-teams")}
                  disabled={!formData.name || !formData.seasonId}>{editingItem ? "Update Team" : "Create Team"}</Button>
              </div>
            </Dialog>
          </>
        )}

        {activeTab === "players" && (
          <>
            <div className="mb-4 flex items-center gap-3">
              <Label className="shrink-0">Season</Label>
              <Select value={selectedSeasonId} onChange={(e) => setSelectedSeasonId(e.target.value)} className="w-64">
                {(!seasons || seasons.length === 0) && <option value="">No seasons available</option>}
                {(seasons || []).map((s: Season) => (
                  <option key={s.id} value={s.id}>{s.name} {s.isCurrent ? "(Current)" : ""}</option>
                ))}
              </Select>
              {(() => {
                const sorted = (seasons || []).slice().sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
                const idx = sorted.findIndex((s) => s.id === selectedSeasonId);
                const prevSeason = idx > 0 ? sorted[idx - 1] : null;
                return prevSeason ? (
                  <Button size="sm" variant="outline" onClick={async () => {
                    if (!confirm(`Copy all players from "${prevSeason.name}" to this season?`)) return;
                    try { setActionError(""); await api.post(`/admin/seasons/${selectedSeasonId}/copy-players-from/${prevSeason.id}`, {}); queryClient.invalidateQueries({ queryKey: ["admin-players"] }); } catch (e: any) { setActionError(e.message); }
                  }}>Copy from {prevSeason.name}</Button>
                ) : null;
              })()}
            </div>
            <DataTable<Player>
              title="Players"
              columns={[
                { key: "photo", label: "Photo", render: (p) => <img src={p.photoUrl || "/placeholder.svg"} alt="" className="h-10 w-10 rounded-xl bg-muted object-cover shadow-sm" /> },
                { key: "name", label: "Name", sortable: true, render: (p) => <span className="font-medium">{p.firstName} {p.lastName}</span> },
                { key: "team", label: "Team", sortable: true, render: (p) => p.team?.name || "-" },
                { key: "position", label: "Position", render: (p) => p.position || "-" },
                { key: "jersey", label: "Jersey", render: (p) => p.jerseyNumber || "-" },
              ]}
              data={players?.data || []}
              keyExtractor={(p) => p.id}
              total={players?.meta?.total}
              onSearch={setPlayerSearch}
              onAdd={() => { setEditingItem(null); openForm("player", { firstName: "", lastName: "", position: "", teamId: "", jerseyNumber: "", squadType: "", nationality: "", age: "", height: "", weight: "", preferredFoot: "", biography: "" }); }}
              onEdit={(p) => { setEditingItem(p); openForm("player", { firstName: p.firstName, lastName: p.lastName || "", position: p.position || "", teamId: p.teamId || "", jerseyNumber: p.jerseyNumber || "", squadType: p.squadType || "", photoUrl: p.photoUrl || "", nationality: p.nationality || "", age: p.age || "", height: p.height || "", weight: p.weight || "", preferredFoot: p.preferredFoot || "", biography: p.biography || "" }); }}
              onDelete={(p) => { if (confirm(`Delete player ${p.firstName} ${p.lastName}?`)) api.delete(`/admin/players/${p.id}`).then(() => queryClient.invalidateQueries({ queryKey: ["admin-players"] })).catch((e: any) => setActionError(e.message)); }}
            />
            <Dialog open={showForm === "player"} onClose={() => { setShowForm(null); setEditingItem(null); }} title={editingItem ? "Edit Player" : "Add Player"}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>First Name *</Label>
                    <Input value={formData.firstName || ""} onChange={(e) => handleFormChange("firstName", e.target.value)} placeholder="First name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Last Name</Label>
                    <Input value={formData.lastName || ""} onChange={(e) => handleFormChange("lastName", e.target.value)} placeholder="Last name" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Position</Label>
                    <Select value={formData.position || ""} onChange={(e) => handleFormChange("position", e.target.value)}>
                      <option value="">Select position...</option>
                      <option value="GK">Goalkeeper (GK)</option>
                      <option value="DEF">Defender (DEF)</option>
                      <option value="MID">Midfielder (MID)</option>
                      <option value="FWD">Forward (FWD)</option>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Jersey #</Label>
                    <Input type="number" min={1} max={99} value={formData.jerseyNumber || ""} onChange={(e) => handleFormChange("jerseyNumber", e.target.value ? parseInt(e.target.value) : null)} placeholder="10" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Squad Type</Label>
                  <Select value={formData.squadType || ""} onChange={(e) => handleFormChange("squadType", e.target.value)}>
                    <option value="">Select squad type...</option>
                    <option value="STARTER">Starter (6 per team)</option>
                    <option value="SUBSTITUTE">Substitute (2 per team)</option>
                    <option value="RESERVE">Reserve (4 per team)</option>
                  </Select>
                </div>
                <details className="rounded-lg border p-3">
                  <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">Personal Info</summary>
                  <div className="mt-3 grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Nationality</Label>
                      <Input value={formData.nationality || ""} onChange={(e) => handleFormChange("nationality", e.target.value)} placeholder="e.g. Indian" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Age</Label>
                      <Input type="number" min={15} max={60} value={formData.age || ""} onChange={(e) => handleFormChange("age", e.target.value ? parseInt(e.target.value) : null)} placeholder="25" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Height (cm)</Label>
                      <Input type="number" min={100} max={250} value={formData.height || ""} onChange={(e) => handleFormChange("height", e.target.value ? parseInt(e.target.value) : null)} placeholder="175" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Weight (kg)</Label>
                      <Input type="number" min={40} max={150} value={formData.weight || ""} onChange={(e) => handleFormChange("weight", e.target.value ? parseInt(e.target.value) : null)} placeholder="70" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Preferred Foot</Label>
                      <Select value={formData.preferredFoot || ""} onChange={(e) => handleFormChange("preferredFoot", e.target.value)}>
                        <option value="">Select...</option>
                        <option value="Left">Left</option>
                        <option value="Right">Right</option>
                        <option value="Both">Both</option>
                      </Select>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <Label>Biography</Label>
                    <textarea value={formData.biography || ""} onChange={(e) => handleFormChange("biography", e.target.value)} rows={3} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="Player biography..." />
                  </div>
                </details>
                <div className="space-y-1.5">
                  <Label>Team *</Label>
                  <Select value={formData.teamId || ""} onChange={(e) => handleFormChange("teamId", e.target.value)} disabled={editingItem && !currentSeason?.transferWindowOpen}>
                    <option value="">Select team...</option>
                    {(teams || []).map((t: Team) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </Select>
                  {(editingItem && !currentSeason?.transferWindowOpen) && <p className="text-xs text-destructive">Transfer window closed — team cannot be changed</p>}
                </div>
                <ImageUploadField label="Player Photo" value={formData.photoUrl || ""} onChange={(value) => handleFormChange("photoUrl", value)} />
                {formErrors && <p className="text-sm text-destructive">{formErrors}</p>}
                <Button className="w-full" onClick={() => submitForm("player", "/admin/players", "admin-players")}
                  disabled={!formData.firstName || !formData.teamId}>{editingItem ? "Update Player" : "Create Player"}</Button>
              </div>
            </Dialog>
          </>
        )}

        {activeTab === "player-stats" && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Label>Season</Label>
              <Select value={selectedSeasonId} onChange={(e) => setSelectedSeasonId(e.target.value)} className="w-64">{(seasons || []).map((s: Season) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
              <Button variant={friendlyStatsMode ? "default" : "outline"} onClick={() => setFriendlyStatsMode((v) => !v)}>{friendlyStatsMode ? "Friendly stats" : "League stats"}</Button>
              <p className="text-xs text-muted-foreground">Appearances are capped to fixtures where the player was in the lineup or matchday squad.</p>
            </div>
            <DataTable<any>
              title={friendlyStatsMode ? "Friendly Player Stats" : "League Player Stats"}
              columns={[
                { key: "player", label: "Player", sortable: true, render: (s) => <span className="font-medium">{s.player.firstName} {s.player.lastName}</span> },
                { key: "team", label: "Team", render: (s) => s.team?.name || "-" },
                { key: "appearances", label: "Apps", render: (s) => s.appearances },
                { key: "goals", label: "Goals", render: (s) => s.goals },
                { key: "assists", label: "Assists", render: (s) => s.assists },
                { key: "manage", label: "Manage", render: (s) => <Button size="sm" variant="outline" onClick={() => { setEditingItem(s); openForm("player-stats", { ...s }); }}><Edit2 className="mr-1 h-3.5 w-3.5" /> Edit</Button> },
              ]}
              data={editablePlayerStats || []}
              keyExtractor={(s) => s.id}
            />
            <Dialog open={showForm === "player-stats"} onClose={() => { setShowForm(null); setEditingItem(null); }} title={`Edit ${friendlyStatsMode ? "Friendly" : "League"} Stats`}>
              <div className="grid grid-cols-2 gap-4">
                {[["appearances", "Appearances"], ["goals", "Goals"], ["assists", "Assists"], ["minutesPlayed", "Minutes"], ["shots", "Shots"], ["shotsOnTarget", "Shots on target"], ["yellowCards", "Yellow cards"], ["redCards", "Red cards"], ["averageRating", "Rating"]].map(([key, label]) => <div key={key} className="space-y-1.5"><Label>{label}</Label><Input type="number" min={0} max={key === "averageRating" ? 10 : undefined} step={key === "averageRating" ? "0.1" : "1"} value={formData[key] ?? 0} onChange={(e) => handleFormChange(key, e.target.value === "" ? 0 : Number(e.target.value))} /></div>)}
                <p className="col-span-2 text-xs text-muted-foreground">Appearances cannot exceed eligible fixtures for this player.</p>
                {formErrors && <p className="col-span-2 text-sm text-destructive">{formErrors}</p>}
                <Button className="col-span-2" onClick={async () => { try { await api.patch(`/admin/player-stats/${editingItem.playerId}`, { seasonId: selectedSeasonId, teamId: editingItem.teamId, friendly: friendlyStatsMode, ...formData }); setShowForm(null); setEditingItem(null); queryClient.invalidateQueries({ queryKey: ["admin-player-stats"] }); } catch (e: any) { setFormErrors(e.message || "Failed to save stats"); } }}>Save stats</Button>
              </div>
            </Dialog>
          </>
        )}

        {activeTab === "fixtures" && (
          <>
            <DataTable<Fixture>
              title="Fixtures"
              columns={[
                { key: "home", label: "Home", sortable: true, render: (f) => <span className="font-medium">{f.homeTeam?.name || "?"}</span> },
                { key: "score", label: "Score", render: (f) => <span className="font-bold">{f.status === "COMPLETED" ? `${f.homeScore ?? 0} - ${f.awayScore ?? 0}` : "vs"}</span> },
                { key: "away", label: "Away", sortable: true, render: (f) => <span className="font-medium">{f.awayTeam?.name || "?"}</span> },
                { key: "date", label: "Date", sortable: true, render: (f) => <span className="text-muted-foreground">{formatDate(f.matchDate)}</span> },
                { key: "status", label: "Status", render: (f) => <Badge variant="secondary">{f.status}</Badge> },
                { key: "manage", label: "Manage", render: (f) => (
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => setLineupFixture(f)}>
                      <Users className="h-3.5 w-3.5" /> Lineups
                    </Button>
                    <Button size="sm" variant={f.status === "LIVE" ? "default" : "outline"} onClick={() => setLiveStatsFixtureId(f.id)}>
                      <Activity className="h-3.5 w-3.5" /> Live
                    </Button>
                  </div>
                ) },
              ]}
              data={fixtures?.data || []}
              keyExtractor={(f) => f.id}
              total={fixtures?.meta?.total}
              onSearch={setFixtureSearch}
              onAdd={() => { setEditingItem(null); openForm("fixture", { homeTeamId: "", awayTeamId: "", matchDate: "", kickoffTime: "", seasonId: seasons?.[0]?.id || "", isFriendly: false }); }}
              onEdit={(f) => { setEditingItem(f); openForm("fixture", { homeTeamId: f.homeTeamId, awayTeamId: f.awayTeamId, matchDate: f.matchDate, kickoffTime: f.kickoffTime || "", seasonId: f.seasonId, isFriendly: !!(f as any).isFriendly, stadium: f.stadium || "", referee: (f as any).referee || "", referee2: (f as any).referee2 || "", matchReport: (f as any).matchReport || "" }); }}
              onDelete={(f) => { if (confirm(`Delete fixture ${f.homeTeam?.name} vs ${f.awayTeam?.name}?`)) api.delete(`/admin/fixtures/${f.id}`).then(() => queryClient.invalidateQueries({ queryKey: ["admin-fixtures"] })).catch((e: any) => setActionError(e.message)); }}
              bulkActions={[
                { label: "Delete", icon: <Trash2 className="h-4 w-4" />, variant: "destructive", confirmMessage: (count) => `Delete ${count} selected fixture(s)?`, onClick: async (items) => { for (const f of items) { try { await api.delete(`/admin/fixtures/${f.id}`); } catch {} } queryClient.invalidateQueries({ queryKey: ["admin-fixtures"] }); } },
              ]}
            />
            <Dialog open={showForm === "fixture"} onClose={() => { setShowForm(null); setEditingItem(null); }} title={editingItem ? "Edit Fixture" : "Add Fixture"}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Home Team *</Label>
                    <Select value={formData.homeTeamId || ""} onChange={(e) => handleFormChange("homeTeamId", e.target.value)}>
                      <option value="">Select home team...</option>
                      {(teams || []).map((t: Team) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Away Team *</Label>
                    <Select value={formData.awayTeamId || ""} onChange={(e) => handleFormChange("awayTeamId", e.target.value)}>
                      <option value="">Select away team...</option>
                      {(teams || []).map((t: Team) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Date *</Label>
                    <Input type="date" value={formData.matchDate?.split("T")[0] || ""} onChange={(e) => handleFormChange("matchDate", new Date(e.target.value).toISOString())} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Kickoff Time</Label>
                    <Input type="time" value={formData.kickoffTime || ""} onChange={(e) => handleFormChange("kickoffTime", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Season</Label>
                  <Select value={formData.seasonId || ""} onChange={(e) => handleFormChange("seasonId", e.target.value)}>
                    {(seasons || []).map((s: Season) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!formData.isFriendly} onChange={(e) => handleFormChange("isFriendly", e.target.checked)} />
                  Friendly match (excluded from standings and league statistics)
                </label>
                <div className="space-y-1.5">
                  <Label>Stadium / Venue</Label>
                  <Input value={formData.stadium || ""} onChange={(e) => handleFormChange("stadium", e.target.value)} placeholder="e.g. Fusion Arena" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Referee</Label>
                    <Input value={formData.referee || ""} onChange={(e) => handleFormChange("referee", e.target.value)} placeholder="Referee name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Assistant Referee</Label>
                    <Input value={formData.referee2 || ""} onChange={(e) => handleFormChange("referee2", e.target.value)} placeholder="Assistant name" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Match Report</Label>
                  <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={formData.matchReport || ""} onChange={(e) => handleFormChange("matchReport", e.target.value)} placeholder="Match summary / report" />
                </div>
                {formErrors && <p className="text-sm text-destructive">{formErrors}</p>}
                <Button className="w-full" onClick={() => submitForm("fixture", "/admin/fixtures", "admin-fixtures")}
                  disabled={!formData.homeTeamId || !formData.awayTeamId || !formData.matchDate}>Create Fixture</Button>
              </div>
            </Dialog>
            <Dialog open={showForm === "score"} onClose={() => { setShowForm(null); setEditingItem(null); }} title="Update Score">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Home Score</Label>
                    <Input type="number" min={0} value={formData.homeScore ?? 0} onChange={(e) => handleFormChange("homeScore", parseInt(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Away Score</Label>
                    <Input type="number" min={0} value={formData.awayScore ?? 0} onChange={(e) => handleFormChange("awayScore", parseInt(e.target.value) || 0)} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" variant="outline" onClick={async () => {
                    try {
                      await api.patch(`/admin/fixtures/${formData.fixtureId}/score`, { homeScore: formData.homeScore, awayScore: formData.awayScore });
                      setEditingItem(null);
                      setShowForm(null);
                      queryClient.invalidateQueries({ queryKey: ["admin-fixtures"] });
                    } catch (err: any) {
                      setFormErrors(err.message);
                    }
                  }}>Update Score Only</Button>
                  <Button className="flex-1" onClick={async () => {
                    try {
                      await api.post(`/admin/process-match-result/${formData.fixtureId}`, { homeScore: formData.homeScore, awayScore: formData.awayScore });
                      setEditingItem(null);
                      setShowForm(null);
                      queryClient.invalidateQueries({ queryKey: ["admin-fixtures"] });
                      queryClient.invalidateQueries({ queryKey: ["admin-standings"] });
                    } catch (err: any) {
                      setFormErrors(err.message);
                    }
                  }}>Process Full Result</Button>
                </div>
              </div>
            </Dialog>
            <Dialog open={showForm === "squad"} onClose={() => { setShowForm(null); setEditingItem(null); }} title={`Squad Selection: ${formData.homeTeamName || "?"} vs ${formData.awayTeamName || "?"}`}>
              {(formData.fixtureId && formData.seasonId) ? <SquadSelector
                fixtureId={formData.fixtureId}
                homeTeamId={formData.homeTeamId}
                awayTeamId={formData.awayTeamId}
                seasonId={formData.seasonId}
                api={api}
                queryClient={queryClient}
                onClose={() => setShowForm(null)}
                teams={teams || []}
              /> : <p className="p-4 text-muted-foreground">Loading...</p>}
            </Dialog>
          </>
        )}

        {activeTab === "awards" && (
          <>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Awards</h2>
                <Button size="sm" onClick={() => { setEditingItem(null); openForm("award", { name: "", description: "", trophyImageUrl: "", type: "PLAYER", seasonId: seasons?.[0]?.id || "" }); }}>
                  <Plus className="mr-1 h-4 w-4" /> Add Award
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(awards || []).map((a: Award) => (
                  <Card key={a.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">{a.name} <Badge variant="outline" className="ml-1 text-[10px]">{a.type === "TEAM" ? "Team" : "Player"}</Badge></CardTitle>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setEditingItem(a); openForm("award", { name: a.name, slug: a.slug, description: a.description || "", trophyImageUrl: a.trophyImageUrl || "", seasonId: a.seasonId, type: a.type }); }}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {a.trophyImageUrl && (
                        <img src={a.trophyImageUrl} alt={a.name} className="mb-3 h-20 w-20 rounded-lg object-cover shadow-sm" />
                      )}
                      {a.description && <p className="mb-2 text-sm text-muted-foreground">{a.description}</p>}
                      <p className="text-sm text-muted-foreground">
                        {a.type === "TEAM" 
                          ? (a.winnerTeam ? `Winner: ${a.winnerTeam.name}` : a.votingEnabled ? "Voting Open" : "No winner yet")
                          : a.winner ? `Winner: ${a.winner.firstName} ${a.winner.lastName}` : a.votingEnabled ? "Voting Open" : "No winner yet"}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {a.type !== "TEAM" && (
                          <Button variant="outline" size="sm" onClick={() => {
                            api.patch(`/admin/awards/${a.id}/voting`, { enabled: !a.votingEnabled }).then(() => queryClient.invalidateQueries({ queryKey: ["admin-awards"] }));
                          }}>
                            {a.votingEnabled ? "Close Voting" : "Open Voting"}
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => { setSelectedWinner(null); setWinnerSearchTerm(""); setWinnerResults([]); openForm("winner", { awardId: a.id, seasonId: a.seasonId, awardType: a.type, playerId: "", teamId: "" }); }}>
                          Announce Winner
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
            <Dialog open={showForm === "award"} onClose={() => { setShowForm(null); setEditingItem(null); }} title={editingItem ? "Edit Award" : "Add Award"}>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Award Name</Label>
                  <Input value={formData.name || ""} onChange={(e) => handleFormChange("name", e.target.value)} placeholder="e.g. Golden Boot" />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <textarea value={formData.description || ""} onChange={(e) => handleFormChange("description", e.target.value)} rows={3} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="Award description" />
                </div>
                <div className="space-y-1.5">
                  <ImageUploadField label="Trophy Image" value={formData.trophyImageUrl || ""} onChange={(value) => handleFormChange("trophyImageUrl", value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Season</Label>
                  <Select value={formData.seasonId || ""} onChange={(e) => handleFormChange("seasonId", e.target.value)}>
                    {(seasons || []).map((s: Season) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={formData.type || "PLAYER"} onChange={(e) => handleFormChange("type", e.target.value)}>
                    <option value="PLAYER">Player Award</option>
                    <option value="TEAM">Team Award</option>
                  </Select>
                </div>
                {formErrors && <p className="text-sm text-destructive">{formErrors}</p>}
                <Button className="w-full" onClick={() => submitForm("award", "/admin/awards", "admin-awards")}
                  disabled={!formData.name}>{editingItem ? "Update Award" : "Create Award"}</Button>
              </div>
            </Dialog>
            <Dialog open={showForm === "winner"} onClose={() => { setShowForm(null); setSelectedWinner(null); setWinnerSearchTerm(""); setWinnerResults([]); }} title="Announce Winner">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Search {formData.awardType === "TEAM" ? "Team" : "Player"}</Label>
                  <Input value={winnerSearchTerm} onChange={async (e) => {
                    const term = e.target.value;
                    setWinnerSearchTerm(term);
                    setSelectedWinner(null);
                    if (formData.awardType === "TEAM") {
                      const filtered = (teams || []).filter((t: Team) =>
                        t.name.toLowerCase().includes(term.toLowerCase())
                      ).slice(0, 10);
                      setWinnerResults(filtered.map((t: Team) => ({ id: t.id, name: t.name, logoUrl: t.logoUrl })));
                    } else if (term.length >= 2) {
                      setWinnerLoading(true);
                      try {
                        const res = await api.get<any[]>("/admin/players/search", { q: term });
                        setWinnerResults(res);
                      } catch { setWinnerResults([]); }
                      setWinnerLoading(false);
                    } else { setWinnerResults([]); }
                  }} placeholder={`Type to search ${formData.awardType === "TEAM" ? "teams" : "players"}...`} />
                  {winnerLoading && <p className="text-xs text-muted-foreground">Searching...</p>}
                </div>
                {selectedWinner && (
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
                    {formData.awardType === "TEAM" ? (
                      <>
                        {selectedWinner.logoUrl && <img src={selectedWinner.logoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />}
                        <span className="font-medium">{selectedWinner.name}</span>
                      </>
                    ) : (
                      <>
                        {selectedWinner.photoUrl && <img src={selectedWinner.photoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />}
                        <span className="font-medium">{selectedWinner.firstName} {selectedWinner.lastName}</span>
                        {selectedWinner.team?.name && <span className="text-sm text-muted-foreground">({selectedWinner.team.name})</span>}
                      </>
                    )}
                    <Button variant="ghost" size="sm" className="ml-auto" onClick={() => { setSelectedWinner(null); setWinnerSearchTerm(""); setWinnerResults([]); }}>Change</Button>
                  </div>
                )}
                {!selectedWinner && winnerResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto rounded-lg border">
                    {winnerResults.map((item: any) => (
                      <div key={item.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50" onClick={() => {
                        setSelectedWinner(item);
                        setWinnerResults([]);
                        setWinnerSearchTerm(formData.awardType === "TEAM" ? item.name : `${item.firstName} ${item.lastName}`);
                        handleFormChange(formData.awardType === "TEAM" ? "teamId" : "playerId", item.id);
                      }}>
                        {formData.awardType === "TEAM" ? (
                          <>
                            {item.logoUrl && <img src={item.logoUrl} alt="" className="h-7 w-7 rounded-full object-cover" />}
                            <span>{item.name}</span>
                          </>
                        ) : (
                          <>
                            {item.photoUrl && <img src={item.photoUrl} alt="" className="h-7 w-7 rounded-full object-cover" />}
                            <span>{item.firstName} {item.lastName}</span>
                            {item.team?.name && <span className="ml-auto text-xs text-muted-foreground">{item.team.name}</span>}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <Button className="w-full" onClick={async () => {
                  try {
                    const payload: any = { seasonId: formData.seasonId };
                    if (formData.awardType === "TEAM") {
                      payload.teamId = formData.teamId;
                    } else {
                      payload.playerId = formData.playerId;
                    }
                    await api.post(`/admin/awards/${formData.awardId}/announce-winner`, payload);
                    setShowForm(null);
                    setSelectedWinner(null);
                    setWinnerSearchTerm("");
                    setWinnerResults([]);
                    queryClient.invalidateQueries({ queryKey: ["admin-awards"] });
                  } catch (err: any) { setFormErrors(err.message); }
                }} disabled={formData.awardType === "TEAM" ? !formData.teamId : !formData.playerId}>Confirm Winner</Button>
              </div>
            </Dialog>
          </>
        )}

        {activeTab === "gallery" && (
          <>
            <AdminTable
              title="Gallery"
              columns={["Image", "Title", "Active", "Created"]}
              data={galleryItems?.data || []}
              renderRow={(g: Gallery) => [
                <img src={g.imageUrl || "/placeholder.svg"} alt={g.title} className="h-10 w-10 rounded-md bg-muted object-cover" />,
                <span className="font-medium">{g.title}</span>,
                g.isActive !== false ? <Badge className="bg-primary">Active</Badge> : <Badge variant="destructive">Inactive</Badge>,
                g.createdAt ? formatDate(g.createdAt) : "-",
              ]}
              onAdd={() => { setEditingItem(null); openForm("gallery", { title: "", imageUrl: "", videoUrl: "", isActive: true }); }}
              onEdit={(g) => { setEditingItem(g); openForm("gallery", { title: g.title, imageUrl: g.imageUrl || "", videoUrl: g.videoUrl || "", isActive: g.isActive ?? true }); }}
              onDelete={(g) => { if (confirm("Delete this gallery item?")) api.delete(`/admin/gallery/${g.id}`).then(() => queryClient.invalidateQueries({ queryKey: ["admin-gallery"] })).catch((e: any) => setActionError(e.message)); }}
            />
            <Dialog open={showForm === "gallery"} onClose={() => { setShowForm(null); setEditingItem(null); }} title={editingItem ? "Edit Gallery Item" : "Add Gallery Item"}>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input value={formData.title || ""} onChange={(e) => handleFormChange("title", e.target.value)} placeholder="Photo title" />
                </div>
                <div className="space-y-1.5">
                  <ImageUploadField label="Image" value={formData.imageUrl || ""} onChange={(value) => handleFormChange("imageUrl", value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Video URL (optional)</Label>
                  <Input value={formData.videoUrl || ""} onChange={(e) => handleFormChange("videoUrl", e.target.value)} placeholder="https://..." />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={formData.isActive ?? true} onChange={(e) => handleFormChange("isActive", e.target.checked)} className="rounded" />
                  Active
                </label>
                {formErrors && <p className="text-sm text-destructive">{formErrors}</p>}
                <Button className="w-full" onClick={() => submitForm("gallery", "/admin/gallery", "admin-gallery")}
                  disabled={!formData.title || !formData.imageUrl}>{editingItem ? "Update Gallery Item" : "Add to Gallery"}</Button>
              </div>
            </Dialog>
          </>
        )}

        {activeTab === "venues" && (
          <>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Venues & Turfs</h2>
                <Button size="sm" onClick={() => openForm("venue", { name: "", city: "", state: "", address: "", description: "", coverImage: "", openingTime: "06:00", closingTime: "23:00" })}>
                  <Plus className="mr-1 h-4 w-4" /> Add Venue
                </Button>
              </div>
              {(venues?.data || []).map((v: Venue) => (
                <Card key={v.id}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                        {v.coverImage ? <img src={v.coverImage} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <MapPin className="h-6 w-6 text-muted-foreground" />}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{v.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{v.city}, {v.state} • {v.openingTime} - {v.closingTime}{v.lastBookingTime ? ` • Last booking: ${v.lastBookingTime}` : ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openForm("venueCalendar", { venueId: v.id })}>
                        <CalendarDays className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openForm("venueEdit", { id: v.id, slug: v.slug, name: v.name, city: v.city, state: v.state, address: v.address || "", description: v.description || "", coverImage: v.coverImage || "", openingTime: v.openingTime, closingTime: v.closingTime, lastBookingTime: v.lastBookingTime || "", bookingMessageTemplate: v.bookingMessageTemplate || "" })}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => {
                        if (confirm("Delete this venue?")) api.delete(`/admin/venues/${v.id}`).then(() => queryClient.invalidateQueries({ queryKey: ["admin-venues"] })).catch((e: any) => setActionError(e.message));
                      }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {v.turfs && v.turfs.length > 0 ? (
                      <div className="space-y-2">
                        {v.turfs.map((t: Turf) => (
                          <div key={t.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-primary" />
                              <span className="font-medium">{t.name}</span>
                              <span className="text-muted-foreground">• {t.size} • {t.surface}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-medium">₹{(t.basePrice / 100).toFixed(0)}/hr</span>
                              <Button variant="ghost" size="sm" onClick={() => openForm("turfEdit", { id: t.id, venueId: v.id, name: t.name, size: t.size || "5-a-side", surface: t.surface || "Artificial", imageUrl: (t as any).imageUrl || "", basePrice: t.basePrice, peakPrice: (t as any).peakPrice || 0, weekendPrice: (t as any).weekendPrice || 0, halfHourBilling: (t as any).halfHourBilling })}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => {
                                if (confirm("Delete this turf?")) api.delete(`/admin/turfs/${t.id}`).then(() => queryClient.invalidateQueries({ queryKey: ["admin-venues"] })).catch((e: any) => setActionError(e.message));
                              }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No turfs yet</p>
                    )}
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => openForm("turf", { venueId: v.id, name: "", size: "5-a-side", surface: "Artificial", basePrice: 50000, peakPrice: 0, weekendPrice: 0, halfHourBilling: false })}>
                      <Plus className="mr-1 h-4 w-4" /> Add Turf
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Dialog open={showForm === "venue"} onClose={() => setShowForm(null)} title="Add Venue">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input value={formData.name || ""} onChange={(e) => handleFormChange("name", e.target.value)} placeholder="Venue name" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>City</Label>
                    <Input value={formData.city || ""} onChange={(e) => handleFormChange("city", e.target.value)} placeholder="City" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>State</Label>
                    <Input value={formData.state || ""} onChange={(e) => handleFormChange("state", e.target.value)} placeholder="State" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Address</Label>
                  <Input value={formData.address || ""} onChange={(e) => handleFormChange("address", e.target.value)} placeholder="Address" />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Input value={formData.description || ""} onChange={(e) => handleFormChange("description", e.target.value)} placeholder="Description" />
                </div>
                <ImageUploadField label="Cover Image" value={formData.coverImage || ""} onChange={(value) => handleFormChange("coverImage", value)} />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Opening Time</Label>
                    <Input type="time" value={formData.openingTime || "06:00"} onChange={(e) => handleFormChange("openingTime", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Closing Time</Label>
                    <Input type="time" value={formData.closingTime || "23:00"} onChange={(e) => handleFormChange("closingTime", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Last Booking Time</Label>
                  <Input type="time" value={formData.lastBookingTime || ""} onChange={(e) => handleFormChange("lastBookingTime", e.target.value)} />
                  <p className="text-[11px] text-muted-foreground">Latest time customers can start a booking. Leave empty to use closing time.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>WhatsApp Booking Message Template</Label>
                  <textarea
                    value={formData.bookingMessageTemplate || ""}
                    onChange={(e) => handleFormChange("bookingMessageTemplate", e.target.value)}
                    rows={4}
                    placeholder={"Hi {customer}, your booking at {venue} is confirmed!\nDate: {date}\nTime: {startTime} - {endTime}\nAmount: Rs {amount}\nBooking ID: {bookingNumber}"}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <p className="text-[11px] text-muted-foreground">Placeholders: {"{customer}"} {"{venue}"} {"{date}"} {"{startTime}"} {"{endTime}"} {"{amount}"} {"{bookingNumber}"}</p>
                </div>
                {formErrors && <p className="text-sm text-destructive">{formErrors}</p>}
                <Button className="w-full" onClick={() => submitForm("venue", "/admin/venues", "admin-venues")}
                  disabled={!formData.name}>Create Venue</Button>
              </div>
            </Dialog>
            <Dialog open={showForm === "venueEdit"} onClose={() => setShowForm(null)} title="Edit Venue">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input value={formData.name || ""} onChange={(e) => handleFormChange("name", e.target.value)} placeholder="Venue name" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>City</Label>
                    <Input value={formData.city || ""} onChange={(e) => handleFormChange("city", e.target.value)} placeholder="City" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>State</Label>
                    <Input value={formData.state || ""} onChange={(e) => handleFormChange("state", e.target.value)} placeholder="State" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Address</Label>
                  <Input value={formData.address || ""} onChange={(e) => handleFormChange("address", e.target.value)} placeholder="Address" />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Input value={formData.description || ""} onChange={(e) => handleFormChange("description", e.target.value)} placeholder="Description" />
                </div>
                <ImageUploadField label="Cover Image" value={formData.coverImage || ""} onChange={(value) => handleFormChange("coverImage", value)} />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Opening Time</Label>
                    <Input type="time" value={formData.openingTime || "06:00"} onChange={(e) => handleFormChange("openingTime", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Closing Time</Label>
                    <Input type="time" value={formData.closingTime || "23:00"} onChange={(e) => handleFormChange("closingTime", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Last Booking Time</Label>
                  <Input type="time" value={formData.lastBookingTime || ""} onChange={(e) => handleFormChange("lastBookingTime", e.target.value)} />
                  <p className="text-[11px] text-muted-foreground">Latest time customers can start a booking. Leave empty to use closing time.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>WhatsApp Booking Message Template</Label>
                  <textarea
                    value={formData.bookingMessageTemplate || ""}
                    onChange={(e) => handleFormChange("bookingMessageTemplate", e.target.value)}
                    rows={4}
                    placeholder={"Hi {customer}, your booking at {venue} is confirmed!\nDate: {date}\nTime: {startTime} - {endTime}\nAmount: Rs {amount}\nBooking ID: {bookingNumber}"}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <p className="text-[11px] text-muted-foreground">Placeholders: {"{customer}"} {"{venue}"} {"{date}"} {"{startTime}"} {"{endTime}"} {"{amount}"} {"{bookingNumber}"}</p>
                </div>
                {formErrors && <p className="text-sm text-destructive">{formErrors}</p>}
                <Button className="w-full" onClick={async () => {
                  try {
                    await api.patch(`/admin/venues/${formData.id}`, { name: formData.name, city: formData.city, state: formData.state, address: formData.address, description: formData.description, coverImage: formData.coverImage, openingTime: formData.openingTime, closingTime: formData.closingTime, lastBookingTime: formData.lastBookingTime || null, bookingMessageTemplate: formData.bookingMessageTemplate || null });
                    setShowForm(null);
                    queryClient.invalidateQueries({ queryKey: ["admin-venues"] });
                  } catch (err: any) { setFormErrors(err.message); }
                }} disabled={!formData.name}>Save Venue</Button>
              </div>
            </Dialog>
            <Dialog open={showForm === "turf"} onClose={() => setShowForm(null)} title="Add Turf">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input value={formData.name || ""} onChange={(e) => handleFormChange("name", e.target.value)} placeholder="Turf name" />
                </div>
                <div className="space-y-1.5">
                  <Label>Size</Label>
                  <Select value={formData.size || "5-a-side"} onChange={(e) => handleFormChange("size", e.target.value)}>
                    <option value="5-a-side">5-a-side</option>
                    <option value="7-a-side">7-a-side</option>
                    <option value="11-a-side">11-a-side</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Surface</Label>
                  <Select value={formData.surface || "Artificial"} onChange={(e) => handleFormChange("surface", e.target.value)}>
                    <option value="Artificial">Artificial</option>
                    <option value="Natural">Natural Grass</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <ImageUploadField label="Image" value={formData.imageUrl || ""} onChange={(value) => handleFormChange("imageUrl", value)} />
                </div>
                  <div className="space-y-1.5">
                    <Label>Base Price (₹ per hour)</Label>
                    <Input type="number" min={0} value={formData.basePrice ? Math.round(formData.basePrice / 100) : ""} onChange={(e) => handleFormChange("basePrice", (parseInt(e.target.value) || 0) * 100)} placeholder="e.g. 500" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Peak Price (₹ per hour, optional)</Label>
                    <Input type="number" min={0} value={formData.peakPrice ? Math.round(formData.peakPrice / 100) : ""} onChange={(e) => handleFormChange("peakPrice", (parseInt(e.target.value) || 0) * 100)} placeholder="e.g. 700" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Weekend Price (₹ per hour, optional)</Label>
                    <Input type="number" min={0} value={formData.weekendPrice ? Math.round(formData.weekendPrice / 100) : ""} onChange={(e) => handleFormChange("weekendPrice", (parseInt(e.target.value) || 0) * 100)} placeholder="e.g. 600" />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!formData.halfHourBilling} onChange={(e) => handleFormChange("halfHourBilling", e.target.checked)} />
                    Half-hour pricing (each 30 min = half the hourly rate)
                  </label>
                  {formErrors && <p className="text-sm text-destructive">{formErrors}</p>}
                  <Button className="w-full" onClick={async () => {
                    try {
                      await api.post("/admin/turfs", { name: formData.name, venueId: formData.venueId, size: formData.size, surface: formData.surface, imageUrl: formData.imageUrl, basePrice: formData.basePrice, peakPrice: formData.peakPrice, weekendPrice: formData.weekendPrice, halfHourBilling: formData.halfHourBilling });
                    setShowForm(null);
                    queryClient.invalidateQueries({ queryKey: ["admin-venues"] });
                  } catch (err: any) { setFormErrors(err.message); }
                }} disabled={!formData.name}>Create Turf</Button>
              </div>
            </Dialog>
              <Dialog open={showForm === "turfEdit"} onClose={() => setShowForm(null)} title="Edit Turf">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input value={formData.name || ""} onChange={(e) => handleFormChange("name", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Size</Label>
                  <Select value={formData.size || "5-a-side"} onChange={(e) => handleFormChange("size", e.target.value)}>
                    <option value="5-a-side">5-a-side</option>
                    <option value="7-a-side">7-a-side</option>
                    <option value="11-a-side">11-a-side</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Surface</Label>
                  <Select value={formData.surface || "Artificial"} onChange={(e) => handleFormChange("surface", e.target.value)}>
                    <option value="Artificial">Artificial</option>
                    <option value="Natural">Natural Grass</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <ImageUploadField label="Image" value={formData.imageUrl || ""} onChange={(value) => handleFormChange("imageUrl", value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Base Price (₹ per hour)</Label>
                  <Input type="number" min={0} value={formData.basePrice ? Math.round(formData.basePrice / 100) : ""} onChange={(e) => handleFormChange("basePrice", (parseInt(e.target.value) || 0) * 100)} placeholder="e.g. 500" />
                </div>
                <div className="space-y-1.5">
                  <Label>Peak Price (₹ per hour, optional)</Label>
                  <Input type="number" min={0} value={formData.peakPrice ? Math.round(formData.peakPrice / 100) : ""} onChange={(e) => handleFormChange("peakPrice", (parseInt(e.target.value) || 0) * 100)} placeholder="e.g. 700" />
                </div>
                <div className="space-y-1.5">
                  <Label>Weekend Price (₹ per hour, optional)</Label>
                  <Input type="number" min={0} value={formData.weekendPrice ? Math.round(formData.weekendPrice / 100) : ""} onChange={(e) => handleFormChange("weekendPrice", (parseInt(e.target.value) || 0) * 100)} placeholder="e.g. 600" />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!formData.halfHourBilling} onChange={(e) => handleFormChange("halfHourBilling", e.target.checked)} />
                  Half-hour pricing (each 30 min = half the hourly rate)
                </label>
                <Button className="w-full" onClick={async () => {
                  try {
                    await api.patch(`/admin/turfs/${formData.id}`, { name: formData.name, size: formData.size, surface: formData.surface, imageUrl: formData.imageUrl, basePrice: formData.basePrice, peakPrice: formData.peakPrice, weekendPrice: formData.weekendPrice, halfHourBilling: formData.halfHourBilling });
                    setShowForm(null);
                    queryClient.invalidateQueries({ queryKey: ["admin-venues"] });
                  } catch (err: any) { setFormErrors(err.message); }
                }}>Save Turf</Button>
              </div>
            </Dialog>
            <Dialog open={showForm === "venueCalendar"} onClose={() => setShowForm(null)} title="">
              <div className="max-w-2xl">
                <VenueCalendar venueId={formData.venueId || ""} venues={venues?.data || []} onClose={() => setShowForm(null)} />
              </div>
            </Dialog>
          </>
        )}

        {activeTab === "bookings" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Bookings</h2>
            <DataTable<Booking>
              title=""
              columns={[
                { key: "bookingNumber", label: "#", render: (b) => <span className="font-medium">{b.bookingNumber}</span> },
                { key: "customer", label: "Customer", sortable: true, render: (b) => <>{b.user?.firstName || "?"} {b.user?.lastName || ""}<br /><span className="text-xs text-muted-foreground">{b.user?.phone || ""}</span></> },
                { key: "venue", label: "Venue", render: (b) => <>{b.turf?.venue?.name || "?"}<br /><span className="text-xs text-muted-foreground">{b.turf?.name || ""}</span></> },
                { key: "date", label: "Date", sortable: true, render: (b) => <span className="text-muted-foreground">{formatDate(b.date)}</span> },
                { key: "time", label: "Time", render: (b) => <>{b.startTime} - {b.endTime}</> },
                { key: "amount", label: "Amount", sortable: true, render: (b) => <>₹{(b.totalAmount / 100).toFixed(2)}</> },
                { key: "status", label: "Status", render: (b) => <Badge variant={b.status === "CONFIRMED" ? "default" : b.status === "CANCELLED" ? "destructive" : "secondary"}>{b.status}</Badge> },
                { key: "whatsapp", label: "", render: (b) => {
                  const phone = b.user?.phone?.replace(/[^0-9]/g, "");
                  const msg = buildBookingMessage(b);
                  if (!msg) return null;
                  const copy = async () => {
                    try {
                      await navigator.clipboard.writeText(msg);
                      setCopiedBookingId(b.id);
                      setTimeout(() => setCopiedBookingId((id) => (id === b.id ? null : id)), 1500);
                    } catch {}
                  };
                  return (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={copy}
                        title="Copy message"
                        className="inline-flex items-center justify-center rounded-lg border p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      {phone && (
                        <a
                          href={`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Send WhatsApp"
                          className="inline-flex items-center justify-center rounded-lg border p-1.5 text-primary transition-colors hover:bg-primary/10"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </a>
                      )}
                      {copiedBookingId === b.id && <span className="text-[10px] text-green-600">Copied</span>}
                    </div>
                  );
                } },
              ]}
              data={bookings?.data || []}
              keyExtractor={(b) => b.id}
              total={bookings?.meta?.total}
              onSearch={setBookingSearch}
              onView={(b) => setSelectedBooking(b)}
              bulkActions={[
                { label: "Confirm", onClick: async (ids) => { for (const id of ids) { try { await api.patch(`/admin/bookings/${id}/status`, { status: "CONFIRMED" }); } catch {} } queryClient.invalidateQueries({ queryKey: ["admin-bookings"] }); }, icon: <CheckCircle2 className="h-4 w-4" /> },
                { label: "Cancel", onClick: async (ids) => { for (const id of ids) { try { await api.patch(`/admin/bookings/${id}/status`, { status: "CANCELLED" }); } catch {} } queryClient.invalidateQueries({ queryKey: ["admin-bookings"] }); }, icon: <XCircle className="h-4 w-4" />, variant: "destructive" },
              ]}
            />
          </div>
        )}

        {activeTab === "calendar" && (
          <AdminCalendar venues={venues?.data || []} />
        )}

        {activeTab === "analytics" && (
          <AdminAnalytics />
        )}

        {activeTab === "news" && (
          <>
            <DataTable<News>
              title="News Articles"
              columns={[
                { key: "image", label: "Image", render: (n) => n.imageUrl ? <img src={n.imageUrl} alt="" className="h-10 w-16 rounded object-cover bg-muted" /> : <div className="h-10 w-16 rounded bg-muted" /> },
                { key: "title", label: "Title", sortable: true, render: (n) => <span className="font-medium line-clamp-1">{n.title}</span> },
                { key: "author", label: "Author", render: (n) => n.author || "-" },
                { key: "published", label: "Published", sortable: true, render: (n) => n.publishedAt ? formatDate(n.publishedAt) : "-" },
                { key: "featured", label: "Featured", render: (n) => n.isFeatured ? <Badge>Featured</Badge> : "-" },
              ]}
              data={news?.data || []}
              keyExtractor={(n) => n.id}
              total={news?.meta?.total}
              onSearch={setNewsSearch}
              onAdd={() => { setEditingItem(null); openForm("news", { title: "", excerpt: "", content: "", imageUrl: "", author: "" }); }}
              onEdit={(n) => { setEditingItem(n); openForm("news", { title: n.title, slug: n.slug, excerpt: n.excerpt || "", content: n.content || "", imageUrl: n.imageUrl || "", author: n.author || "" }); }}
              onDelete={(n) => { if (confirm("Delete this article?")) api.delete(`/admin/news/${n.id}`).then(() => queryClient.invalidateQueries({ queryKey: ["admin-news"] })).catch((e: any) => setActionError(e.message)); }}
            />
            <Dialog open={showForm === "news"} onClose={() => { setShowForm(null); setEditingItem(null); }} title={editingItem ? "Edit Article" : "Add News Article"}>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Title *</Label>
                  <Input value={formData.title || ""} onChange={(e) => handleFormChange("title", e.target.value)} placeholder="Article title" />
                </div>
                <div className="space-y-1.5">
                  <Label>Author</Label>
                  <Input value={formData.author || ""} onChange={(e) => handleFormChange("author", e.target.value)} placeholder="Author name" />
                </div>
                <div className="space-y-1.5">
                  <Label>Excerpt</Label>
                  <textarea className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={formData.excerpt || ""} onChange={(e) => handleFormChange("excerpt", e.target.value)} placeholder="Short excerpt" />
                </div>
                <div className="space-y-1.5">
                  <Label>Content (HTML)</Label>
                  <textarea className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={formData.content || ""} onChange={(e) => handleFormChange("content", e.target.value)} placeholder="HTML content" />
                </div>
                <ImageUploadField label="Article Image" value={formData.imageUrl || ""} onChange={(value) => handleFormChange("imageUrl", value)} />
                {formErrors && <p className="text-sm text-destructive">{formErrors}</p>}
                <Button className="w-full" onClick={async () => {
                  try {
                    if (editingItem) {
                      await api.patch(`/admin/news/${editingItem.id}`, { title: formData.title, excerpt: formData.excerpt, content: formData.content, imageUrl: formData.imageUrl, author: formData.author });
                    } else {
                      const slug = slugify(formData.title) || `article-${Date.now()}`;
                      await api.post("/admin/news", { title: formData.title, slug, excerpt: formData.excerpt, content: formData.content, imageUrl: formData.imageUrl, author: formData.author, isPublished: true });
                    }
                    setEditingItem(null);
                    setShowForm(null);
                    queryClient.invalidateQueries({ queryKey: ["admin-news"] });
                  } catch (err: any) { setFormErrors(err.message); }
                }} disabled={!formData.title}>{editingItem ? "Update Article" : "Create Article"}</Button>
              </div>
            </Dialog>
          </>
        )}

        {activeTab === "sponsors" && (
          <>
            <DataTable<Sponsor>
              title="Sponsors"
              columns={[
                { key: "logo", label: "Logo", render: (s) => <img src={s.logoUrl || "/placeholder.svg"} alt="" className="h-8 w-8 rounded-full bg-muted" /> },
                { key: "name", label: "Name", sortable: true, render: (s) => <span className="font-medium">{s.name}</span> },
                { key: "website", label: "Website", render: (s) => s.website ? <a href={s.website} target="_blank" className="text-primary hover:underline">{s.website}</a> : "-" },
                { key: "tier", label: "Tier", sortable: true, render: (s) => s.tier || "-" },
                { key: "status", label: "Status", render: (s) => s.isActive !== false ? <Badge>Active</Badge> : <Badge variant="destructive">Inactive</Badge> },
              ]}
              data={sponsors?.data || []}
              keyExtractor={(s) => s.id}
              onSearch={setSponsorSearch}
              onAdd={() => { setEditingItem(null); openForm("sponsor", { name: "", website: "", tier: "platinum", logoUrl: "", isActive: true }); }}
              onEdit={(s) => { setEditingItem(s); openForm("sponsor", { name: s.name, website: s.website || "", tier: s.tier || "platinum", logoUrl: s.logoUrl || "", isActive: s.isActive !== false }); }}
              onDelete={(s) => { if (confirm("Delete this sponsor?")) api.delete(`/admin/sponsors/${s.id}`).then(() => queryClient.invalidateQueries({ queryKey: ["admin-sponsors"] })).catch((e: any) => setActionError(e.message)); }}
            />
            <Dialog open={showForm === "sponsor"} onClose={() => { setShowForm(null); setEditingItem(null); }} title={editingItem ? "Edit Sponsor" : "Add Sponsor"}>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Sponsor Name *</Label>
                  <Input value={formData.name || ""} onChange={(e) => handleFormChange("name", e.target.value)} placeholder="e.g. Red Bull" />
                </div>
                <div className="space-y-1.5">
                  <Label>Website</Label>
                  <Input value={formData.website || ""} onChange={(e) => handleFormChange("website", e.target.value)} placeholder="https://example.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Tier</Label>
                  <Select value={formData.tier || "platinum"} onChange={(e) => handleFormChange("tier", e.target.value)}>
                    <option value="platinum">Platinum</option>
                    <option value="gold">Gold</option>
                    <option value="silver">Silver</option>
                    <option value="bronze">Bronze</option>
                  </Select>
                </div>
                <ImageUploadField label="Logo" value={formData.logoUrl || ""} onChange={(value) => handleFormChange("logoUrl", value)} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={formData.isActive ?? true} onChange={(e) => handleFormChange("isActive", e.target.checked)} className="rounded" />
                  Active
                </label>
                {formErrors && <p className="text-sm text-destructive">{formErrors}</p>}
                <Button className="w-full" onClick={() => submitForm("sponsor", "/admin/sponsors", "admin-sponsors")}
                  disabled={!formData.name}>{editingItem ? "Update Sponsor" : "Create Sponsor"}</Button>
              </div>
            </Dialog>
          </>
        )}

        {activeTab === "coupons" && (
          <>
            <AdminTable
              title="Coupons"
              columns={["Code", "Discount", "Uses", "Expires", "Active"]}
              data={coupons?.data || []}
              renderRow={(c: Coupon) => [
                <span className="font-mono font-bold">{c.code}</span>,
                c.discountType === "PERCENTAGE" ? `${c.discountValue}%` : `₹${c.discountValue}`,
                <span className="text-sm">{c.usedCount || 0}/{c.maxUses || "∞"}</span>,
                c.expiresAt ? formatDate(c.expiresAt) : "Never",
                c.isActive !== false ? <Badge className="bg-primary">Active</Badge> : <Badge variant="destructive">Inactive</Badge>,
              ]}
              onAdd={() => { setEditingItem(null); openForm("coupon", { code: "", discountType: "PERCENTAGE", discountValue: 10, maxUses: 100, minAmount: 0, isActive: true }); }}
              onEdit={(c) => { setEditingItem(c); openForm("coupon", c); }}
              onDelete={(c) => { if (confirm(`Delete coupon "${c.code}"?`)) api.delete(`/admin/coupons/${c.id}`).then(() => queryClient.invalidateQueries({ queryKey: ["admin-coupons"] })).catch((e: any) => setActionError(e.message)); }}
            />
            <Dialog open={showForm === "coupon"} onClose={() => { setShowForm(null); setEditingItem(null); }} title={editingItem ? "Edit Coupon" : "Add Coupon"}>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Code</Label>
                  <Input value={formData.code || ""} onChange={(e) => handleFormChange("code", e.target.value.toUpperCase())} placeholder="SUMMER25" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select value={formData.discountType || "PERCENTAGE"} onChange={(e) => handleFormChange("discountType", e.target.value)}>
                      <option value="PERCENTAGE">Percentage</option>
                      <option value="FIXED">Fixed</option>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Value</Label>
                    <Input type="number" value={formData.discountValue || 0} onChange={(e) => handleFormChange("discountValue", Number(e.target.value))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Max Uses</Label>
                    <Input type="number" value={formData.maxUses ?? ""} onChange={(e) => handleFormChange("maxUses", e.target.value ? Number(e.target.value) : null)} placeholder="Unlimited" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Min Amount</Label>
                    <Input type="number" value={formData.minAmount ?? 0} onChange={(e) => handleFormChange("minAmount", Number(e.target.value))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Expires At (optional)</Label>
                  <Input type="date" value={formData.expiresAt?.split("T")[0] || ""} onChange={(e) => handleFormChange("expiresAt", e.target.value ? new Date(e.target.value).toISOString() : null)} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={formData.isActive !== false} onChange={(e) => handleFormChange("isActive", e.target.checked)} className="rounded" />
                  Active
                </label>
                {formErrors && <p className="text-sm text-destructive">{formErrors}</p>}
                <Button className="w-full" onClick={() => submitForm("coupon", "/admin/coupons", "admin-coupons")}
                  disabled={!formData.code}>{editingItem ? "Update Coupon" : "Create Coupon"}</Button>
              </div>
            </Dialog>
          </>
        )}

        {activeTab === "ads" && (
          <>
            <AdminTable
              title="Advertisements"
              columns={["Image", "Title", "Position", "Active", "Period"]}
              data={ads?.data || []}
              renderRow={(a: Advertisement) => [
                <img src={a.imageUrl || "/placeholder.svg"} alt={a.title} className="h-10 w-16 rounded bg-muted object-cover" />,
                <span className="font-medium">{a.title}</span>,
                <Badge variant="outline">{a.position || "—"}</Badge>,
                a.isActive !== false ? <Badge className="bg-primary">Active</Badge> : <Badge variant="destructive">Inactive</Badge>,
                <span className="text-xs text-muted-foreground">{a.startsAt ? formatDate(a.startsAt) : "—"} – {a.endsAt ? formatDate(a.endsAt) : "—"}</span>,
              ]}
              onAdd={() => { setEditingItem(null); openForm("ad", { title: "", imageUrl: "", linkUrl: "", position: "banner", isActive: true }); }}
              onEdit={(a) => { setEditingItem(a); openForm("ad", a); }}
              onDelete={(a) => { if (confirm(`Delete ad "${a.title}"?`)) api.delete(`/admin/ads/${a.id}`).then(() => queryClient.invalidateQueries({ queryKey: ["admin-ads"] })).catch((e: any) => setActionError(e.message)); }}
            />
            <Dialog open={showForm === "ad"} onClose={() => { setShowForm(null); setEditingItem(null); }} title={editingItem ? "Edit Advertisement" : "Add Advertisement"}>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input value={formData.title || ""} onChange={(e) => handleFormChange("title", e.target.value)} placeholder="Ad title" />
                </div>
                <div className="space-y-1.5">
                  <ImageUploadField label="Image" value={formData.imageUrl || ""} onChange={(value) => handleFormChange("imageUrl", value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Link URL (optional)</Label>
                  <Input value={formData.linkUrl || ""} onChange={(e) => handleFormChange("linkUrl", e.target.value)} placeholder="https://..." />
                </div>
                <div className="space-y-1.5">
                  <Label>Position</Label>
                  <Select value={formData.position || "banner"} onChange={(e) => handleFormChange("position", e.target.value)}>
                    <option value="hero">Hero</option>
                    <option value="banner">Banner</option>
                    <option value="sidebar">Sidebar</option>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Start Date</Label>
                    <Input type="date" value={formData.startsAt?.split("T")[0] || ""} onChange={(e) => handleFormChange("startsAt", e.target.value ? new Date(e.target.value).toISOString() : null)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>End Date</Label>
                    <Input type="date" value={formData.endsAt?.split("T")[0] || ""} onChange={(e) => handleFormChange("endsAt", e.target.value ? new Date(e.target.value).toISOString() : null)} />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={formData.isActive !== false} onChange={(e) => handleFormChange("isActive", e.target.checked)} className="rounded" />
                  Active
                </label>
                {formErrors && <p className="text-sm text-destructive">{formErrors}</p>}
                <Button className="w-full" onClick={() => submitForm("ad", "/admin/ads", "admin-ads")}
                  disabled={!formData.title || !formData.imageUrl}>{editingItem ? "Update Ad" : "Create Ad"}</Button>
              </div>
            </Dialog>
          </>
        )}

        {activeTab === "faqs" && (
          <>
            <AdminTable
              title="FAQs"
              columns={["Question", "Category", "Order", "Active"]}
              data={faqs?.data || []}
              renderRow={(f: Faq) => [
                <span className="font-medium line-clamp-1">{f.question}</span>,
                <Badge variant="outline">{f.category || "—"}</Badge>,
                f.order ?? 0,
                f.isActive !== false ? <Badge className="bg-primary">Active</Badge> : <Badge variant="destructive">Inactive</Badge>,
              ]}
              onAdd={() => { setEditingItem(null); openForm("faq", { question: "", answer: "", category: "general", order: 0, isActive: true }); }}
              onEdit={(f) => { setEditingItem(f); openForm("faq", f); }}
              onDelete={(f) => { if (confirm(`Delete FAQ "${f.question}"?`)) api.delete(`/admin/faqs/${f.id}`).then(() => queryClient.invalidateQueries({ queryKey: ["admin-faqs"] })).catch((e: any) => setActionError(e.message)); }}
            />
            <Dialog open={showForm === "faq"} onClose={() => { setShowForm(null); setEditingItem(null); }} title={editingItem ? "Edit FAQ" : "Add FAQ"}>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Question</Label>
                  <Input value={formData.question || ""} onChange={(e) => handleFormChange("question", e.target.value)} placeholder="Frequently asked question" />
                </div>
                <div className="space-y-1.5">
                  <Label>Answer</Label>
                  <textarea value={formData.answer || ""} onChange={(e) => handleFormChange("answer", e.target.value)} rows={4} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="Answer..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select value={formData.category || "general"} onChange={(e) => handleFormChange("category", e.target.value)}>
                      <option value="general">General</option>
                      <option value="booking">Booking</option>
                      <option value="league">League</option>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Order</Label>
                    <Input type="number" value={formData.order ?? 0} onChange={(e) => handleFormChange("order", Number(e.target.value))} />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={formData.isActive !== false} onChange={(e) => handleFormChange("isActive", e.target.checked)} className="rounded" />
                  Active
                </label>
                {formErrors && <p className="text-sm text-destructive">{formErrors}</p>}
                <Button className="w-full" onClick={() => submitForm("faq", "/admin/faqs", "admin-faqs")}
                  disabled={!formData.question || !formData.answer}>{editingItem ? "Update FAQ" : "Create FAQ"}</Button>
              </div>
            </Dialog>
          </>
        )}

        {activeTab === "reviews" && (
          <>
            <AdminTable
              title="Reviews"
              columns={["User", "Venue", "Rating", "Comment", "Status"]}
              data={reviews?.data || []}
              renderRow={(r: ReviewAdmin) => [
                <span className="font-medium">{r.user?.firstName} {r.user?.lastName}</span>,
                r.venue?.name || "-",
                <span className="text-yellow-500">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>,
                <span className="max-w-[200px] truncate text-sm text-muted-foreground">{r.comment || "—"}</span>,
                r.isApproved ? <Badge className="bg-primary">Approved</Badge> : <Badge variant="secondary">Pending</Badge>,
              ]}
              onDelete={(r) => { if (confirm("Delete this review?")) api.delete(`/admin/reviews/${r.id}`).then(() => queryClient.invalidateQueries({ queryKey: ["admin-reviews"] })).catch((e: any) => setActionError(e.message)); }}
            />
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" onClick={async () => {
                const pending = (reviews?.data || []).filter((r) => !r.isApproved);
                if (pending.length === 0) return alert("No pending reviews to approve");
                for (const r of pending) {
                  await api.patch(`/admin/reviews/${r.id}/approve`);
                }
                queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
              }}>Approve All Pending</Button>
            </div>
          </>
        )}

        {activeTab === "suspensions" && (
          <>
            <AdminTable
              title="Suspensions"
              columns={["Player", "Team", "Reason", "Bans", "Status", "Dates"]}
              data={suspensions?.data || []}
              renderRow={(s: Suspension) => [
                <span className="font-medium">{s.player?.firstName || "?"} {s.player?.lastName || ""}</span>,
                s.player?.team?.name || "-",
                <Badge variant="secondary">{s.reason?.replace(/_/g, " ")}</Badge>,
                `${s.matchBan} match${s.matchBan !== 1 ? "es" : ""} (${s.served} served)`,
                s.isActive ? <Badge>Active</Badge> : <Badge variant="destructive">Served</Badge>,
                <span className="text-xs text-muted-foreground">{formatDate(s.startDate)} - {formatDate(s.endDate)}</span>,
              ]}
              onAdd={() => { setEditingItem(null); openForm("suspension", { playerId: "", seasonId: seasons?.[0]?.id || "", reason: "YELLOW_ACCUMULATION", matchBan: 1, notes: "" }); }}
              onEdit={(s) => { setEditingItem(s); openForm("suspension", { playerId: s.playerId, seasonId: s.seasonId, reason: s.reason, matchBan: s.matchBan, notes: s.notes || "", isActive: s.isActive }); }}
            />
            <Dialog open={showForm === "suspension"} onClose={() => { setShowForm(null); setEditingItem(null); }} title={editingItem ? "Edit Suspension" : "Add Suspension"}>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Player ID *</Label>
                  <Input value={formData.playerId || ""} onChange={(e) => handleFormChange("playerId", e.target.value)} placeholder="Enter player ID" />
                </div>
                <div className="space-y-1.5">
                  <Label>Season</Label>
                  <Select value={formData.seasonId || ""} onChange={(e) => handleFormChange("seasonId", e.target.value)}>
                    {(seasons || []).map((s: Season) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Reason *</Label>
                  <Select value={formData.reason || "YELLOW_ACCUMULATION"} onChange={(e) => handleFormChange("reason", e.target.value)}>
                    <option value="YELLOW_ACCUMULATION">Yellow Card Accumulation</option>
                    <option value="STRAIGHT_RED">Straight Red Card</option>
                    <option value="SECOND_YELLOW">Second Yellow Card</option>
                    <option value="VIOLENT_CONDUCT">Violent Conduct</option>
                    <option value="SERIOUS_MISCONDUCT">Serious Misconduct</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Match Ban</Label>
                  <Input type="number" min={1} value={formData.matchBan || 1} onChange={(e) => handleFormChange("matchBan", parseInt(e.target.value) || 1)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <Input value={formData.notes || ""} onChange={(e) => handleFormChange("notes", e.target.value)} placeholder="Optional notes" />
                </div>
                {editingItem && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={formData.isActive ?? true} onChange={(e) => handleFormChange("isActive", e.target.checked)} className="rounded" />
                    Active (uncheck to mark as served)
                  </label>
                )}
                {formErrors && <p className="text-sm text-destructive">{formErrors}</p>}
                <Button className="w-full" onClick={() => submitForm("suspension", "/admin/suspensions", "admin-suspensions")}
                  disabled={!formData.playerId || !formData.reason}>{editingItem ? "Update Suspension" : "Create Suspension"}</Button>
              </div>
            </Dialog>
          </>
        )}

        {activeTab === "activity" && (
          <AdminTable
            title="Activity Logs"
            columns={["Time", "User", "Action", "Entity", "Details"]}
            data={activityLogs?.data || []}
            renderRow={(l: ActivityLog) => [
              <span className="text-xs text-muted-foreground">{formatDate(l.createdAt)}</span>,
              l.user ? `${l.user.firstName} ${l.user.lastName}` : "-",
              <Badge variant="secondary">{l.action}</Badge>,
              <span className="text-xs">{l.entity} {l.entityId ? `#${l.entityId.slice(0, 8)}` : ""}</span>,
              l.metadata ? <span className="text-xs text-muted-foreground">{JSON.stringify(l.metadata).slice(0, 60)}</span> : "-",
            ]}
          />
        )}

        {activeTab === "settings" && (
          <>
            <div className="space-y-6">
              {/* Site Images */}
              <Card>
                <CardHeader><CardTitle>Site Images</CardTitle></CardHeader>
                <CardContent className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Site Logo</p>
                    {settings?.site_logo_url ? (
                      <div className="relative overflow-hidden border bg-muted p-4">
                        <img src={settings.site_logo_url} alt="Logo" className="mx-auto h-16 w-auto object-contain" />
                        <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => openForm("editSetting", { key: "site_logo_url", value: settings.site_logo_url })}>Change Image</Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 border border-dashed p-6">
                        <Image className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">No logo set</p>
                        <Button variant="outline" size="sm" onClick={() => openForm("editSetting", { key: "site_logo_url", value: "" })}>Upload Logo</Button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Hero Banner</p>
                    {settings?.site_hero_url ? (
                      <div className="relative overflow-hidden border bg-muted">
                        <img src={settings.site_hero_url} alt="Hero" className="aspect-video w-full object-cover" />
                        <div className="p-2">
                          <Button variant="outline" size="sm" className="w-full" onClick={() => openForm("editSetting", { key: "site_hero_url", value: settings.site_hero_url })}>Change Image</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 border border-dashed p-6">
                        <Image className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">No hero banner</p>
                        <Button variant="outline" size="sm" onClick={() => openForm("editSetting", { key: "site_hero_url", value: "" })}>Upload Hero</Button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Favicon</p>
                    {settings?.site_favicon_url ? (
                      <div className="flex items-center gap-3 border p-4">
                        <img src={settings.site_favicon_url} alt="Favicon" className="h-8 w-8 object-contain" />
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-xs text-muted-foreground">{settings.site_favicon_url}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => openForm("editSetting", { key: "site_favicon_url", value: settings.site_favicon_url })}>Change</Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between border border-dashed p-4">
                        <p className="text-sm text-muted-foreground">No favicon set</p>
                        <Button variant="outline" size="sm" onClick={() => openForm("editSetting", { key: "site_favicon_url", value: "" })}>Upload</Button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Site Name (Page Title)</p>
                    <div className="flex items-center gap-2 border p-4">
                      <p className="flex-1 text-sm font-medium truncate">{settings?.site_name || "Fusion Turf"}</p>
                      <Button variant="outline" size="sm" onClick={() => openForm("editSetting", { key: "site_name", value: settings?.site_name || "" })}>Edit</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Invoice Settings */}
              <Card>
                <CardHeader><CardTitle>Invoice Settings</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">UPI QR Code</p>
                    {settings?.invoice_upi_qr ? (
                      <div className="flex flex-wrap items-center gap-4 border p-4">
                        <img src={settings.invoice_upi_qr} alt="UPI QR" className="h-24 w-24 rounded-lg border object-contain" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">This QR will appear on every printed invoice so customers can scan and pay.</p>
                          <div className="mt-2 flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => openForm("editSetting", { key: "invoice_upi_qr", value: settings.invoice_upi_qr })}>Change QR</Button>
                            <Button variant="ghost" size="sm" onClick={async () => {
                              try {
                                await api.patch("/admin/settings", { invoice_upi_qr: "" });
                                queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
                              } catch (e: any) { setActionError(e.message); }
                            }}>Remove</Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 border border-dashed p-6">
                        <QrCode className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">No UPI QR set — invoices will not show a QR code.</p>
                        <Button variant="outline" size="sm" onClick={() => openForm("editSetting", { key: "invoice_upi_qr", value: "" })}>Upload UPI QR</Button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Invoice Terms &amp; Conditions</p>
                    <div className="border p-4">
                      <p className="max-h-32 overflow-y-auto whitespace-pre-line text-xs text-muted-foreground">{settings?.invoice_terms || "No custom terms set. Default terms will be used on invoices."}</p>
                      <Button variant="outline" size="sm" className="mt-2" onClick={() => openForm("editSetting", { key: "invoice_terms", value: settings?.invoice_terms || "" })}>Edit Terms</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* All Settings */}
              <Card>
                <CardHeader><CardTitle>All Settings</CardTitle></CardHeader>
                <CardContent>
                  {settings && Object.entries(settings).length > 0 ? (
                    <div className="space-y-4">
                      {Object.entries(settings).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between border p-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{key}</p>
                            <p className="truncate text-xs text-muted-foreground">{String(value)}</p>
                          </div>
                          <Button variant="ghost" size="sm" className="shrink-0" onClick={() => openForm("editSetting", { key, value: String(value) })}><Edit2 className="h-4 w-4" /></Button>
                        </div>
                      ))}
                      <Button className="mt-4" onClick={() => openForm("addSetting", { key: "", value: "" })}><Plus className="mr-2 h-4 w-4" /> Add Setting</Button>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Settings className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium">No Settings Yet</h3>
                      <p className="text-sm text-muted-foreground mb-4">Add settings like site name, contact info, etc.</p>
                      <Button onClick={() => openForm("addSetting", { key: "", value: "" })}><Plus className="mr-2 h-4 w-4" /> Add First Setting</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            <Dialog open={showForm === "editSetting"} onClose={() => setShowForm(null)} title={`Edit Setting`}>
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Setting: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{formData.key}</code></p>
                  {["site_logo_url", "site_hero_url", "site_favicon_url", "invoice_upi_qr"].includes(formData.key) ? (
                    <ImageUploadField label={formData.key === "invoice_upi_qr" ? "UPI QR Code" : "Image"} value={formData.value || ""} onChange={(value) => handleFormChange("value", value)} />
                  ) : formData.key === "invoice_terms" ? (
                    <>
                      <Label>Terms &amp; Conditions</Label>
                      <textarea
                        value={formData.value || ""}
                        onChange={(e) => handleFormChange("value", e.target.value)}
                        rows={10}
                        placeholder={"1. Booking confirmation is subject to slot availability.\n2. Full payment must be received to confirm the booking.\n..."}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <p className="text-xs text-muted-foreground">One term per line. Leave empty to use default terms.</p>
                    </>
                  ) : (
                    <>
                      <Label>Value</Label>
                      <Input value={formData.value || ""} onChange={(e) => handleFormChange("value", e.target.value)} />
                    </>
                  )}
                </div>
                {formErrors && <p className="text-sm text-destructive">{formErrors}</p>}
                <Button className="w-full" onClick={async () => {
                  try {
                    await api.patch("/admin/settings", { [formData.key]: formData.value });
                    setShowForm(null);
                    queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
                  } catch (err: any) { setFormErrors(err.message); }
                }}>Save</Button>
              </div>
            </Dialog>
            <Dialog open={showForm === "addSetting"} onClose={() => setShowForm(null)} title="Add Setting">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Setting Key</Label>
                  <Input value={formData.key || ""} onChange={(e) => handleFormChange("key", e.target.value)} placeholder="e.g. site_favicon_url, site_name, contact_email" />
                  <p className="text-xs text-muted-foreground">Use snake_case. Examples: <code className="rounded bg-muted px-1">site_name</code>, <code className="rounded bg-muted px-1">site_favicon_url</code>, <code className="rounded bg-muted px-1">contact_phone</code></p>
                </div>
                <div className="space-y-1.5">
                  <Label>Value</Label>
                  <Input value={formData.value || ""} onChange={(e) => handleFormChange("value", e.target.value)} placeholder="Setting value" />
                </div>
                <Button className="w-full" onClick={async () => {
                  try {
                    await api.patch("/admin/settings", { [formData.key]: formData.value });
                    setShowForm(null);
                    queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
                  } catch (err: any) { setFormErrors(err.message); }
                }} disabled={!formData.key}>Add Setting</Button>
              </div>
            </Dialog>
          </>
        )}

        {activeTab === "users" && (
          <DataTable<User>
            title="Users"
            columns={[
              { key: "name", label: "Name", sortable: true, render: (u) => <>{u.firstName} {u.lastName}</> },
              { key: "email", label: "Email", sortable: true, render: (u) => <span className="text-muted-foreground">{u.email}</span> },
              { key: "role", label: "Role", render: (u) => <Badge variant="secondary">{u.role.replace("_", " ")}</Badge> },
              { key: "status", label: "Status", render: (u) => <Badge variant={u.isActive ? "default" : "destructive"}>{u.isActive ? "Active" : "Inactive"}</Badge> },
              { key: "joined", label: "Joined", sortable: true, render: (u) => <span className="text-muted-foreground">{formatDate(u.createdAt)}</span> },
            ]}
            data={users?.data || []}
            keyExtractor={(u) => u.id}
            onSearch={setUserSearch}
          />
        )}
      {liveStatsFixtureId && <MatchControlCenter fixtureId={liveStatsFixtureId} onClose={() => setLiveStatsFixtureId(null)} />}
      {lineupFixture && (
        <LineupEditor
          fixture={lineupFixture}
          onClose={() => setLineupFixture(null)}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ["admin-fixtures"] }); setLineupFixture(null); }}
        />
      )}
      <AnimatePresence>
        {selectedBooking && <BookingDrawer booking={selectedBooking} settings={settings || {}} onClose={() => setSelectedBooking(null)} />}
      </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function ImageUploadField({ label, value, onChange }: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
}) {
  const [error, setError] = useState("");

  const handleFile = (url: string) => {
    onChange(url);
  };

  return (
    <div className="space-y-2">
      <ImageUpload value={value || ""} onChange={(url) => { onChange(url); setError(""); }} label={label} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function TabSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-7 w-40 animate-pulse rounded bg-muted" />
        <div className="h-9 w-28 animate-pulse rounded bg-muted" />
      </div>
      <div className="overflow-hidden rounded-xl border">
        <div className="h-10 animate-pulse bg-secondary/70" />
        {[1,2,3,4,5].map((i) => <div key={i} className="h-12 animate-pulse border-t bg-card" />)}
      </div>
    </div>
  );
}

function InlineEditCell({ value, type, options, onSave }: {
  value: string; type?: "text" | "number" | "select"; options?: string[]; onSave: (val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <span className="cursor-pointer rounded px-1 hover:bg-accent" onClick={() => { setDraft(value); setEditing(true); }} title="Click to edit">
        {value || <span className="text-muted-foreground italic">empty</span>}
      </span>
    );
  }

  if (type === "select" && options) {
    return (
      <select
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { onSave(draft); setEditing(false); }}
        autoFocus
        className="rounded border bg-background px-2 py-1 text-sm"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  return (
    <input
      type={type === "number" ? "number" : "text"}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { onSave(draft); setEditing(false); }}
      onKeyDown={(e) => { if (e.key === "Enter") { onSave(draft); setEditing(false); } if (e.key === "Escape") setEditing(false); }}
      autoFocus
      className="w-full rounded border bg-background px-2 py-1 text-sm"
    />
  );
}

function AdminTable<T extends { id: string }>({ title, columns, data, renderRow, onAdd, onEdit, onDelete, editableColumns }: {
  title: string; columns: string[]; data: T[]; renderRow: (item: T) => React.ReactNode[];
  onAdd?: () => void; onEdit?: (item: T) => void; onDelete?: (item: T) => void;
  editableColumns?: { index: number; type?: "text" | "number" | "select"; options?: string[]; onSave: (item: T, value: string) => void }[];
}) {
  const isMobile = useIsMobile();
  const hasActions = !!(onEdit || onDelete);
  const editableMap = new Map(editableColumns?.map((ec) => [ec.index, ec]) || []);
  const [sheetItem, setSheetItem] = useState<T | null>(null);

  const sheetActions = sheetItem ? [
    ...(onEdit ? [{ label: "Edit", icon: <Edit2 className="h-4 w-4" /> as React.ReactNode, onClick: () => onEdit(sheetItem) }] : []),
    ...(onDelete ? [{ label: "Delete", icon: <Trash2 className="h-4 w-4" /> as React.ReactNode, variant: "destructive" as const, onClick: () => onDelete(sheetItem) }] : []),
  ] : [];

  if (isMobile) {
    return (
      <div className="space-y-4 pb-20">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          {onAdd && <Button size="sm" onClick={onAdd}><Plus className="mr-1 h-4 w-4" /> Add</Button>}
        </div>
        {data.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-muted-foreground">
            <p className="text-sm">No {title.toLowerCase()} yet</p>
          </div>
        ) : (
          data.map((item) => {
            const cells = renderRow(item);
            return (
              <div key={item.id} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-2">
                    {columns.slice(0, 3).map((col, i) => (
                      <div key={col} className="text-sm">
                        <span className="text-xs font-medium text-muted-foreground">{col}: </span>
                        <span>{cells[i]}</span>
                      </div>
                    ))}
                    {columns.length > 3 && (
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer py-1 font-medium">More details</summary>
                        <div className="mt-1.5 space-y-1.5 pl-1">
                          {columns.slice(3).map((col, i) => (
                            <div key={col}>
                              <span className="text-muted-foreground">{col}: </span>
                              {cells[i + 3]}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                  {hasActions && (
                    <button
                      onClick={() => setSheetItem(item)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-muted"
                    >
                      <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        {onAdd && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="fixed bottom-6 right-6 z-30"
          >
            <Button size="lg" className="h-14 w-14 rounded-full shadow-xl bg-primary hover:bg-primary/90" onClick={onAdd}>
              <Plus className="h-6 w-6" />
            </Button>
          </motion.div>
        )}
        <BottomSheet
          open={!!sheetItem}
          onClose={() => setSheetItem(null)}
          title="Actions"
          actions={sheetActions.map((a) => ({ label: a.label, icon: a.icon, variant: a.variant as any, onClick: a.onClick }))}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{title}</h2>
        {onAdd && <Button size="sm" onClick={onAdd}><Plus className="mr-1 h-4 w-4" /> Add {title.slice(0, -1)}</Button>}
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-secondary/70">
            <tr>{columns.map((c) => <th key={c} className="p-3 text-left font-medium">{c}</th>)}{hasActions && <th className="p-3 text-right">Actions</th>}</tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={columns.length + (hasActions ? 1 : 0)} className="p-8 text-center text-muted-foreground">No {title.toLowerCase()} yet</td></tr>
            ) : (
              data.map((item) => (
                <tr key={item.id} className="border-t hover:bg-muted/20">
                  {renderRow(item).map((cell, i) => (
                    <td key={i} className="p-3">
                      {editableMap.has(i) ? (
                        <InlineEditCell
                          value={typeof cell === "string" ? cell : String(cell)}
                          type={editableMap.get(i)!.type}
                          options={editableMap.get(i)!.options}
                          onSave={(val) => editableMap.get(i)!.onSave(item, val)}
                        />
                      ) : cell}
                    </td>
                  ))}
                  {hasActions && <td className="p-3 text-right">
                    {onEdit && <Button variant="ghost" size="sm" onClick={() => onEdit(item)}><Edit2 className="h-4 w-4" /></Button>}
                    {onDelete && <Button variant="ghost" size="sm" onClick={() => onDelete(item)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </td>}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SquadSelector({ fixtureId, homeTeamId, awayTeamId, seasonId, api, queryClient, onClose, teams }: {
  fixtureId: string; homeTeamId: string; awayTeamId: string; seasonId: string; api: any; queryClient: any; onClose: () => void; teams: Team[];
}) {
  const [homeSelected, setHomeSelected] = useState<string[]>([]);
  const [awaySelected, setAwaySelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const { data: homePlayers } = useQuery({
    queryKey: ["admin-squad-home", homeTeamId, seasonId],
    queryFn: async () => { const r = await api.get(`/admin/players`, { teamId: homeTeamId, seasonId, limit: "100" }); return r as { data: Player[] }; },
    enabled: !!homeTeamId && !!seasonId,
  });
  const { data: awayPlayers } = useQuery({
    queryKey: ["admin-squad-away", awayTeamId, seasonId],
    queryFn: async () => { const r = await api.get(`/admin/players`, { teamId: awayTeamId, seasonId, limit: "100" }); return r as { data: Player[] }; },
    enabled: !!awayTeamId && !!seasonId,
  });

  const togglePlayer = (id: string, side: "home" | "away") => {
    const setter = side === "home" ? setHomeSelected : setAwaySelected;
    setter((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await api.post(`/admin/fixtures/${fixtureId}/squad`, { teamId: homeTeamId, playerIds: homeSelected });
      await api.post(`/admin/fixtures/${fixtureId}/squad`, { teamId: awayTeamId, playerIds: awaySelected });
      queryClient.invalidateQueries({ queryKey: ["admin-fixtures"] });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save squad");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4 p-4">
      <div>
        <h3 className="mb-2 text-sm font-semibold">{teams.find(t => t.id === homeTeamId)?.name || "Home"}</h3>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {(homePlayers?.data || []).map((p: Player) => (
            <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded border p-2 text-sm hover:bg-muted/50">
              <input type="checkbox" checked={homeSelected.includes(p.id)} onChange={() => togglePlayer(p.id, "home")} className="rounded" />
              <span>{p.firstName} {p.lastName} {p.jerseyNumber ? `(#${p.jerseyNumber})` : ""} - {p.position || ""}</span>
            </label>
          ))}
          {(!homePlayers?.data || homePlayers.data.length === 0) && <p className="text-xs text-muted-foreground">No players found</p>}
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">{teams.find(t => t.id === awayTeamId)?.name || "Away"}</h3>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {(awayPlayers?.data || []).map((p: Player) => (
            <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded border p-2 text-sm hover:bg-muted/50">
              <input type="checkbox" checked={awaySelected.includes(p.id)} onChange={() => togglePlayer(p.id, "away")} className="rounded" />
              <span>{p.firstName} {p.lastName} {p.jerseyNumber ? `(#${p.jerseyNumber})` : ""} - {p.position || ""}</span>
            </label>
          ))}
          {(!awayPlayers?.data || awayPlayers.data.length === 0) && <p className="text-xs text-muted-foreground">No players found</p>}
        </div>
      </div>
      <div className="col-span-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{teams.find(t => t.id === homeTeamId)?.name || "Home"}: {homeSelected.length}/8</span>
        <span>{teams.find(t => t.id === awayTeamId)?.name || "Away"}: {awaySelected.length}/8</span>
      </div>
      {error && <p className="col-span-2 text-sm text-destructive">{error}</p>}
      <Button className="col-span-2" onClick={handleSave} disabled={saving || homeSelected.length !== 8 || awaySelected.length !== 8}>{saving ? "Saving..." : "Save Squad"}</Button>
    </div>
  );
}
