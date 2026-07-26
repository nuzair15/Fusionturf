import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { DashboardStats, User, Season, Team, Player, Fixture, Award, News, Booking, PaginatedResponse } from "@/types";
import { LayoutDashboard, Users, Calendar, Trophy, Settings, BarChart3, Activity, LogOut, ChevronLeft, Plus, Edit2, Trash2, Medal, Newspaper, DollarSign, Image, Lock } from "lucide-react";

const ADMIN_PASSWORD = "Abdurahman.15";
const STORAGE_KEY = "admin_unlocked";

const adminTabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "seasons", label: "Seasons", icon: Calendar },
  { id: "teams", label: "Teams", icon: Trophy },
  { id: "players", label: "Players", icon: Users },
  { id: "fixtures", label: "Fixtures", icon: Activity },
  { id: "awards", label: "Awards", icon: Medal },
  { id: "bookings", label: "Bookings", icon: Calendar },
  { id: "news", label: "News", icon: Newspaper },
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
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(STORAGE_KEY) === "true");

  const handleUnlock = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, "true");
      setUnlocked(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  if (!unlocked) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md items-center px-4 py-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0a1838] to-[#00d66f]">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Admin Access</h1>
          <p className="mt-2 text-muted-foreground">Enter the admin password to continue.</p>
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
              <p className="text-sm text-destructive">Incorrect password. Try again.</p>
            )}
            <Button type="submit" className="w-full bg-gradient-to-r from-[#0a1838] to-[#00d66f] text-white">
              <Lock className="mr-2 h-4 w-4" /> Unlock
            </Button>
          </form>
          <Button variant="ghost" className="mt-4" onClick={() => navigate("/")}>Back to Home</Button>
        </motion.div>
      </div>
    );
  }

  const { data: dashboard } = useQuery({ queryKey: ["admin-dashboard"], queryFn: () => api.get<DashboardStats>("/admin/dashboard") });

  const { data: users } = useQuery({ queryKey: ["admin-users"], queryFn: () => api.get<{ data: User[] }>("/admin/users", { limit: "20" }) });

  const { data: seasons } = useQuery({ queryKey: ["admin-seasons"], queryFn: () => api.get<Season[]>("/admin/seasons") });

  const { data: teams } = useQuery({ queryKey: ["admin-teams"], queryFn: () => api.get<Team[]>("/admin/teams") });

  const { data: players } = useQuery({ queryKey: ["admin-players"], queryFn: () => api.get<PaginatedResponse<Player>>("/admin/players", { limit: "50" }) });

  const { data: fixtures } = useQuery({ queryKey: ["admin-fixtures"], queryFn: () => api.get<PaginatedResponse<Fixture>>("/admin/fixtures", { limit: "50" }) });

  const { data: awards } = useQuery({ queryKey: ["admin-awards"], queryFn: () => api.get<Award[]>("/admin/awards") });

  const { data: bookings } = useQuery({ queryKey: ["admin-bookings"], queryFn: () => api.get<PaginatedResponse<Booking>>("/admin/bookings", { limit: "50" }) });

  const { data: news } = useQuery({ queryKey: ["admin-news"], queryFn: () => api.get<PaginatedResponse<News>>("/admin/news", { limit: "50" }) });

  const { data: settings } = useQuery({ queryKey: ["admin-settings"], queryFn: () => api.get<Record<string, string>>("/admin/settings") });

  const stats = dashboard?.stats;

  const handleLogout = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    navigate("/");
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => navigate("/")} className="mb-2 gap-1"><ChevronLeft className="h-4 w-4" /> Back to Site</Button>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage Fusion League platform</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">Admin</Badge>
            <Button variant="ghost" size="icon" onClick={handleLogout}><LogOut className="h-5 w-5" /></Button>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {adminTabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all ${activeTab === tab.id ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"}`}>
              <tab.icon className="h-4 w-4" /> {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Total Users", value: stats?.totalUsers || 0, icon: Users, color: "text-blue-500" },
                { label: "Total Bookings", value: stats?.totalBookings || 0, icon: Calendar, color: "text-green-500" },
                { label: "Teams", value: stats?.totalTeams || 0, icon: Trophy, color: "text-purple-500" },
                { label: "Revenue", value: stats?.totalRevenue ? formatCurrency(stats.totalRevenue) : "₹0", icon: DollarSign, color: "text-yellow-500" },
              ].map((stat) => (
                <Card key={stat.label}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                        <p className="text-2xl font-bold">{stat.value}</p>
                      </div>
                      <stat.icon className={`h-8 w-8 ${stat.color}`} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Recent Fixtures</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {dashboard?.recentFixtures?.slice(0, 5).map((f) => (
                    <div key={f.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                      <span>{f.homeTeam?.shortName || "?"} vs {f.awayTeam?.shortName || "?"}</span>
                      <Badge variant="secondary">{f.status}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
                <CardContent className="grid gap-2">
                  {adminTabs.filter(t => t.id !== "overview").map(tab => (
                    <Button key={tab.id} variant="outline" className="justify-start" onClick={() => setActiveTab(tab.id)}>
                      <tab.icon className="mr-2 h-4 w-4" /> Manage {tab.label}
                    </Button>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "seasons" && (
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
              </div>,
              s._count?.teams || 0,
              s._count?.players || 0,
              s._count?.fixtures || 0,
            ]}
            onAdd={() => {
              const name = prompt("Season name:");
              if (name) api.post("/admin/seasons", { name, slug: name.toLowerCase().replace(/\s+/g, "-"), startDate: new Date().toISOString(), endDate: new Date(Date.now() + 365*86400000).toISOString(), isActive: true, isCurrent: true }).then(() => queryClient.invalidateQueries({ queryKey: ["admin-seasons"] }));
            }}
          />
        )}

        {activeTab === "teams" && (
          <AdminTable
            title="Teams"
            columns={["Logo", "Name", "City", "Players", "Matches"]}
            data={teams || []}
            renderRow={(t: Team) => [
              <img src={t.logoUrl || "/placeholder.svg"} alt="" className="h-8 w-8 rounded-full bg-muted" />,
              <span className="font-medium">{t.name}</span>,
              t.city || "-",
              t._count?.players || 0,
              t._count?.homeMatches || 0,
            ]}
            onAdd={() => {
              const name = prompt("Team name:");
              if (name) api.post("/admin/teams", { name, slug: name.toLowerCase().replace(/\s+/g, "-"), seasonId: seasons?.[0]?.id || "", shortName: name.substring(0, 3).toUpperCase(), city: prompt("City:") || "" }).then(() => queryClient.invalidateQueries({ queryKey: ["admin-teams"] }));
            }}
          />
        )}

        {activeTab === "players" && (
          <AdminTable
            title="Players"
            columns={["Photo", "Name", "Team", "Position", "Jersey"]}
            data={players?.data || []}
            renderRow={(p: Player) => [
              <img src={p.photoUrl || "/placeholder.svg"} alt="" className="h-8 w-8 rounded-full bg-muted" />,
              <span className="font-medium">{p.firstName} {p.lastName}</span>,
              p.team?.name || "-",
              p.position || "-",
              p.jerseyNumber || "-",
            ]}
            onAdd={() => {
              const fn = prompt("First name:");
              if (fn) api.post("/admin/players", { firstName: fn, lastName: prompt("Last name:") || "", slug: `${fn.toLowerCase()}-${Math.random().toString(36).slice(2, 6)}`, seasonId: seasons?.[0]?.id || "", teamId: prompt("Team ID (optional):") || undefined, position: prompt("Position (GK/DEF/MID/FWD):") }).then(() => queryClient.invalidateQueries({ queryKey: ["admin-players"] }));
            }}
          />
        )}

        {activeTab === "fixtures" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Fixtures</h2>
              <Button size="sm" onClick={() => setShowForm("fixture")}>
                <Plus className="mr-1 h-4 w-4" /> Add Fixture
              </Button>
            </div>
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-3 text-left">Home</th>
                    <th className="p-3 text-center">Score</th>
                    <th className="p-3 text-left">Away</th>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(fixtures?.data || []).map((f: Fixture) => (
                    <tr key={f.id} className="border-t">
                      <td className="p-3 font-medium">{f.homeTeam?.name || "?"}</td>
                      <td className="p-3 text-center font-bold">{f.status === "COMPLETED" ? `${f.homeScore ?? 0} - ${f.awayScore ?? 0}` : "vs"}</td>
                      <td className="p-3 font-medium">{f.awayTeam?.name || "?"}</td>
                      <td className="p-3 text-muted-foreground">{formatDate(f.matchDate)}</td>
                      <td className="p-3"><Badge variant="secondary">{f.status}</Badge></td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => {
                          const hs = prompt("Home score:", String(f.homeScore ?? 0));
                          if (hs !== null) api.patch(`/admin/fixtures/${f.id}/score`, { homeScore: parseInt(hs), awayScore: parseInt(prompt("Away score:", String(f.awayScore ?? 0)) || "0") }).then(() => queryClient.invalidateQueries({ queryKey: ["admin-fixtures"] }));
                        }}><Edit2 className="h-4 w-4" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "awards" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Awards</h2>
              <Button size="sm" onClick={() => setShowForm("award")}>
                <Plus className="mr-1 h-4 w-4" /> Add Award
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(awards || []).map((a: Award) => (
                <Card key={a.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{a.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {a.winner ? `Winner: ${a.winner.firstName} ${a.winner.lastName}` : a.votingEnabled ? "Voting Open" : "No winner yet"}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => {
                        api.patch(`/admin/awards/${a.id}/voting`, { enabled: !a.votingEnabled }).then(() => queryClient.invalidateQueries({ queryKey: ["admin-awards"] }));
                      }}>
                        {a.votingEnabled ? "Close Voting" : "Open Voting"}
                      </Button>
                      {!a.winnerAnnounced && (
                        <Button variant="outline" size="sm" onClick={() => {
                          const pid = prompt("Player ID for winner:");
                          if (pid) api.post(`/admin/awards/${a.id}/announce-winner`, { playerId: pid, seasonId: a.seasonId }).then(() => queryClient.invalidateQueries({ queryKey: ["admin-awards"] }));
                        }}>Announce Winner</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === "bookings" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Bookings</h2>
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-3 text-left">#</th>
                    <th className="p-3 text-left">Customer</th>
                    <th className="p-3 text-left">Venue</th>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Time</th>
                    <th className="p-3 text-left">Amount</th>
                    <th className="p-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(bookings?.data || []).map((b: Booking) => (
                    <tr key={b.id} className="border-t">
                      <td className="p-3 font-medium">{b.bookingNumber}</td>
                      <td className="p-3">{b.user?.firstName || "?"} {b.user?.lastName || ""}</td>
                      <td className="p-3">{b.turf?.venue?.name || "?"}</td>
                      <td className="p-3 text-muted-foreground">{formatDate(b.date)}</td>
                      <td className="p-3">{b.startTime} - {b.endTime}</td>
                      <td className="p-3">₹{(b.totalAmount / 100).toFixed(2)}</td>
                      <td className="p-3"><Badge variant={b.status === "CONFIRMED" ? "default" : b.status === "CANCELLED" ? "destructive" : "secondary"}>{b.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "news" && (
          <AdminTable
            title="News Articles"
            columns={["Image", "Title", "Author", "Published", "Featured"]}
            data={news?.data || []}
            renderRow={(n: News) => [
              n.imageUrl ? <img src={n.imageUrl} alt="" className="h-10 w-16 rounded object-cover bg-muted" /> : <div className="h-10 w-16 rounded bg-muted" />,
              <span className="font-medium line-clamp-1">{n.title}</span>,
              n.author || "-",
              n.publishedAt ? formatDate(n.publishedAt) : "-",
              n.isFeatured ? <Badge>Featured</Badge> : "-",
            ]}
            onAdd={() => {
              const title = prompt("News title:");
              if (title) api.post("/admin/news", { title, slug: title.toLowerCase().replace(/\s+/g, "-"), excerpt: prompt("Excerpt:"), content: prompt("Content (HTML):"), imageUrl: prompt("Image URL:"), author: prompt("Author:"), isPublished: true }).then(() => queryClient.invalidateQueries({ queryKey: ["admin-news"] }));
            }}
          />
        )}

        {activeTab === "settings" && (
          <Card>
            <CardHeader><CardTitle>Site Settings</CardTitle></CardHeader>
            <CardContent>
              {settings && Object.entries(settings).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(settings).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">{key}</p>
                        <p className="text-xs text-muted-foreground break-all">{String(value)}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => {
                        const newVal = prompt(`Value for ${key}:`, String(value));
                        if (newVal !== null) api.patch("/admin/settings", { [key]: newVal }).then(() => queryClient.invalidateQueries({ queryKey: ["admin-settings"] }));
                      }}><Edit2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button className="mt-4" onClick={() => {
                    const key = prompt("Setting key:");
                    if (key) api.patch("/admin/settings", { [key]: prompt(`Value for ${key}:`) }).then(() => queryClient.invalidateQueries({ queryKey: ["admin-settings"] }));
                  }}><Plus className="mr-2 h-4 w-4" /> Add Setting</Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Settings className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No Settings Yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">Add settings like site name, contact info, etc.</p>
                  <Button onClick={() => {
                    const key = prompt("Setting key:");
                    if (key) api.patch("/admin/settings", { [key]: prompt(`Value for ${key}:`) }).then(() => queryClient.invalidateQueries({ queryKey: ["admin-settings"] }));
                  }}><Plus className="mr-2 h-4 w-4" /> Add First Setting</Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "users" && (
          <Card>
            <CardHeader><CardTitle>Users</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3 text-left">Name</th>
                      <th className="p-3 text-left">Email</th>
                      <th className="p-3 text-left">Role</th>
                      <th className="p-3 text-left">Status</th>
                      <th className="p-3 text-left">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(users?.data || []).map((u: User) => (
                      <tr key={u.id} className="border-t">
                        <td className="p-3">{u.firstName} {u.lastName}</td>
                        <td className="p-3 text-muted-foreground">{u.email}</td>
                        <td className="p-3"><Badge variant="secondary">{u.role.replace("_", " ")}</Badge></td>
                        <td className="p-3"><Badge variant={u.isActive ? "default" : "destructive"}>{u.isActive ? "Active" : "Inactive"}</Badge></td>
                        <td className="p-3 text-muted-foreground">{formatDate(u.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  );
}

function AdminTable<T extends { id: string }>({ title, columns, data, renderRow, onAdd }: {
  title: string; columns: string[]; data: T[]; renderRow: (item: T) => React.ReactNode[]; onAdd?: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{title}</h2>
        {onAdd && <Button size="sm" onClick={onAdd}><Plus className="mr-1 h-4 w-4" /> Add {title.slice(0, -1)}</Button>}
      </div>
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>{columns.map((c) => <th key={c} className="p-3 text-left font-medium">{c}</th>)}</tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={columns.length} className="p-8 text-center text-muted-foreground">No {title.toLowerCase()} yet</td></tr>
            ) : (
              data.map((item) => (
                <tr key={item.id} className="border-t hover:bg-muted/20">
                  {renderRow(item).map((cell, i) => <td key={i} className="p-3">{cell}</td>)}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
