import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { DashboardStats, User, Season, Team, Player, Fixture, Award, News, Booking, PaginatedResponse, Venue, Turf, Sponsor } from "@/types";
import { LayoutDashboard, Users, Calendar, Trophy, Settings, BarChart3, Activity, LogOut, ChevronLeft, Plus, Edit2, Trash2, Medal, Newspaper, DollarSign, Image, Lock, MapPin, Handshake } from "lucide-react";

const ADMIN_PASSWORD = "Abdurahman.15";
const STORAGE_KEY = "admin_unlocked";

const adminTabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "seasons", label: "Seasons", icon: Calendar },
  { id: "teams", label: "Teams", icon: Trophy },
  { id: "players", label: "Players", icon: Users },
  { id: "fixtures", label: "Fixtures", icon: Activity },
  { id: "awards", label: "Awards", icon: Medal },
  { id: "venues", label: "Venues", icon: MapPin },
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

  // Form state for modals
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<string>("");

  const openForm = (type: string, initial: Record<string, any> = {}) => {
    setFormData(initial);
    setFormErrors("");
    setShowForm(type);
  };

  const handleFormChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const submitForm = async (type: string, url: string, invalidateKey: string) => {
    try {
      setFormErrors("");
      await api.post(url, formData);
      setShowForm(null);
      queryClient.invalidateQueries({ queryKey: [invalidateKey] });
    } catch (err: any) {
      setFormErrors(err.message || "Failed to save");
    }
  };

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

  const { data: venues } = useQuery({ queryKey: ["admin-venues"], queryFn: () => api.get<{ data: Venue[] }>("/admin/venues") });

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
          <>
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
              onAdd={() => openForm("season", { name: "", isActive: true, isCurrent: false })}
            />
            <Dialog open={showForm === "season"} onClose={() => setShowForm(null)} title="Add Season">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Season Name</Label>
                  <Input value={formData.name || ""} onChange={(e) => handleFormChange("name", e.target.value)} placeholder="e.g. Season 2025-2026" />
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
                  disabled={!formData.name}>Create Season</Button>
              </div>
            </Dialog>
          </>
        )}

        {activeTab === "teams" && (
          <>
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
              onAdd={() => openForm("team", { name: "", shortName: "", city: "", seasonId: seasons?.[0]?.id || "" })}
            />
            <Dialog open={showForm === "team"} onClose={() => setShowForm(null)} title="Add Team">
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
                  <Label>Season</Label>
                  <Select value={formData.seasonId || ""} onChange={(e) => handleFormChange("seasonId", e.target.value)}>
                    <option value="">Select season...</option>
                    {(seasons || []).map((s: Season) => (
                      <option key={s.id} value={s.id}>{s.name}{s.isCurrent ? " (Current)" : ""}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Logo URL (optional)</Label>
                  <Input value={formData.logoUrl || ""} onChange={(e) => handleFormChange("logoUrl", e.target.value)} placeholder="https://..." />
                </div>
                {formErrors && <p className="text-sm text-destructive">{formErrors}</p>}
                <Button className="w-full" onClick={() => submitForm("team", "/admin/teams", "admin-teams")}
                  disabled={!formData.name || !formData.seasonId}>Create Team</Button>
              </div>
            </Dialog>
          </>
        )}

        {activeTab === "players" && (
          <>
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
              onAdd={() => openForm("player", { firstName: "", lastName: "", position: "", teamId: "", jerseyNumber: "", seasonId: seasons?.[0]?.id || "" })}
            />
            <Dialog open={showForm === "player"} onClose={() => setShowForm(null)} title="Add Player">
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
                    <Input type="number" min={1} max={99} value={formData.jerseyNumber || ""} onChange={(e) => handleFormChange("jerseyNumber", e.target.value ? parseInt(e.target.value) : "")} placeholder="10" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Team *</Label>
                  <Select value={formData.teamId || ""} onChange={(e) => handleFormChange("teamId", e.target.value)}>
                    <option value="">Select team...</option>
                    {(teams || []).map((t: Team) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </Select>
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
                  <Label>Photo URL (optional)</Label>
                  <Input value={formData.photoUrl || ""} onChange={(e) => handleFormChange("photoUrl", e.target.value)} placeholder="https://..." />
                </div>
                {formErrors && <p className="text-sm text-destructive">{formErrors}</p>}
                <Button className="w-full" onClick={() => submitForm("player", "/admin/players", "admin-players")}
                  disabled={!formData.firstName || !formData.teamId}>Create Player</Button>
              </div>
            </Dialog>
          </>
        )}

        {activeTab === "fixtures" && (
          <>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Fixtures</h2>
                <Button size="sm" onClick={() => openForm("fixture", { homeTeamId: "", awayTeamId: "", matchDate: "", kickoffTime: "", seasonId: seasons?.[0]?.id || "" })}>
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
                          <Button variant="ghost" size="sm" onClick={() => openForm("score", { fixtureId: f.id, homeScore: f.homeScore ?? 0, awayScore: f.awayScore ?? 0 })}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <Dialog open={showForm === "fixture"} onClose={() => setShowForm(null)} title="Add Fixture">
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
                <div className="space-y-1.5">
                  <Label>Stadium / Venue</Label>
                  <Input value={formData.stadium || ""} onChange={(e) => handleFormChange("stadium", e.target.value)} placeholder="e.g. Fusion Arena" />
                </div>
                {formErrors && <p className="text-sm text-destructive">{formErrors}</p>}
                <Button className="w-full" onClick={() => submitForm("fixture", "/admin/fixtures", "admin-fixtures")}
                  disabled={!formData.homeTeamId || !formData.awayTeamId || !formData.matchDate}>Create Fixture</Button>
              </div>
            </Dialog>
            <Dialog open={showForm === "score"} onClose={() => setShowForm(null)} title="Update Score">
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
                <Button className="w-full" onClick={async () => {
                  try {
                    await api.patch(`/admin/fixtures/${formData.fixtureId}/score`, { homeScore: formData.homeScore, awayScore: formData.awayScore });
                    setShowForm(null);
                    queryClient.invalidateQueries({ queryKey: ["admin-fixtures"] });
                  } catch (err: any) {
                    setFormErrors(err.message);
                  }
                }}>Update Score</Button>
              </div>
            </Dialog>
          </>
        )}

        {activeTab === "awards" && (
          <>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Awards</h2>
                <Button size="sm" onClick={() => openForm("award", { name: "", seasonId: seasons?.[0]?.id || "" })}>
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
                        <Button variant="outline" size="sm" onClick={() => openForm("winner", { awardId: a.id, seasonId: a.seasonId, playerId: "" })}>
                          Announce Winner
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
            <Dialog open={showForm === "award"} onClose={() => setShowForm(null)} title="Add Award">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Award Name</Label>
                  <Input value={formData.name || ""} onChange={(e) => handleFormChange("name", e.target.value)} placeholder="e.g. Golden Boot" />
                </div>
                <div className="space-y-1.5">
                  <Label>Season</Label>
                  <Select value={formData.seasonId || ""} onChange={(e) => handleFormChange("seasonId", e.target.value)}>
                    {(seasons || []).map((s: Season) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </Select>
                </div>
                <Button className="w-full" onClick={() => submitForm("award", "/admin/awards", "admin-awards")}
                  disabled={!formData.name}>Create Award</Button>
              </div>
            </Dialog>
            <Dialog open={showForm === "winner"} onClose={() => setShowForm(null)} title="Announce Winner">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Player ID</Label>
                  <Input value={formData.playerId || ""} onChange={(e) => handleFormChange("playerId", e.target.value)} placeholder="Enter player ID" />
                </div>
                <Button className="w-full" onClick={async () => {
                  try {
                    await api.post(`/admin/awards/${formData.awardId}/announce-winner`, { playerId: formData.playerId, seasonId: formData.seasonId });
                    setShowForm(null);
                    queryClient.invalidateQueries({ queryKey: ["admin-awards"] });
                  } catch (err: any) { setFormErrors(err.message); }
                }} disabled={!formData.playerId}>Confirm Winner</Button>
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
                        <p className="text-xs text-muted-foreground">{v.city}, {v.state} • {v.openingTime} - {v.closingTime}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openForm("venueEdit", { id: v.id, name: v.name, city: v.city, state: v.state, address: v.address || "", description: v.description || "", coverImage: v.coverImage || "", openingTime: v.openingTime, closingTime: v.closingTime })}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => {
                        if (confirm("Delete this venue?")) api.delete(`/admin/venues/${v.id}`).then(() => queryClient.invalidateQueries({ queryKey: ["admin-venues"] }));
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
                              <Button variant="ghost" size="sm" onClick={() => openForm("turfEdit", { id: t.id, venueId: v.id, name: t.name, size: t.size || "5-a-side", surface: t.surface || "Artificial", basePrice: t.basePrice })}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => {
                                if (confirm("Delete this turf?")) api.delete(`/admin/turfs/${t.id}`).then(() => queryClient.invalidateQueries({ queryKey: ["admin-venues"] }));
                              }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No turfs yet</p>
                    )}
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => openForm("turf", { venueId: v.id, name: "", size: "5-a-side", surface: "Artificial", basePrice: 50000 })}>
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
                <div className="space-y-1.5">
                  <Label>Cover Image URL</Label>
                  <Input value={formData.coverImage || ""} onChange={(e) => handleFormChange("coverImage", e.target.value)} placeholder="https://..." />
                </div>
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
                <div className="space-y-1.5">
                  <Label>Cover Image URL</Label>
                  <Input value={formData.coverImage || ""} onChange={(e) => handleFormChange("coverImage", e.target.value)} placeholder="https://..." />
                </div>
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
                <Button className="w-full" onClick={async () => {
                  try {
                    await api.patch(`/admin/venues/${formData.id}`, { name: formData.name, city: formData.city, state: formData.state, address: formData.address, description: formData.description, coverImage: formData.coverImage, openingTime: formData.openingTime, closingTime: formData.closingTime });
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
                  <Label>Base Price (in paise, ₹500 = 50000)</Label>
                  <Input type="number" min={0} value={formData.basePrice || 50000} onChange={(e) => handleFormChange("basePrice", parseInt(e.target.value) || 50000)} />
                </div>
                <Button className="w-full" onClick={async () => {
                  try {
                    await api.post("/admin/turfs", { name: formData.name, venueId: formData.venueId, slug: formData.name.toLowerCase().replace(/\s+/g, "-"), size: formData.size, surface: formData.surface, basePrice: formData.basePrice });
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
                  <Label>Base Price (in paise)</Label>
                  <Input type="number" min={0} value={formData.basePrice || 50000} onChange={(e) => handleFormChange("basePrice", parseInt(e.target.value) || 50000)} />
                </div>
                <Button className="w-full" onClick={async () => {
                  try {
                    await api.patch(`/admin/turfs/${formData.id}`, { name: formData.name, size: formData.size, surface: formData.surface, basePrice: formData.basePrice });
                    setShowForm(null);
                    queryClient.invalidateQueries({ queryKey: ["admin-venues"] });
                  } catch (err: any) { setFormErrors(err.message); }
                }}>Save Turf</Button>
              </div>
            </Dialog>
          </>
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
          <>
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
              onAdd={() => openForm("news", { title: "", excerpt: "", content: "", imageUrl: "", author: "" })}
            />
            <Dialog open={showForm === "news"} onClose={() => setShowForm(null)} title="Add News Article">
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
                <div className="space-y-1.5">
                  <Label>Image URL</Label>
                  <Input value={formData.imageUrl || ""} onChange={(e) => handleFormChange("imageUrl", e.target.value)} placeholder="https://..." />
                </div>
                <Button className="w-full" onClick={async () => {
                  try {
                    const slug = formData.title.toLowerCase().replace(/\s+/g, "-");
                    await api.post("/admin/news", { title: formData.title, slug, excerpt: formData.excerpt, content: formData.content, imageUrl: formData.imageUrl, author: formData.author, isPublished: true });
                    setShowForm(null);
                    queryClient.invalidateQueries({ queryKey: ["admin-news"] });
                  } catch (err: any) { setFormErrors(err.message); }
                }} disabled={!formData.title}>Create Article</Button>
              </div>
            </Dialog>
          </>
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
                        <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => openForm("editSetting", { key: "site_logo_url", value: settings.site_logo_url })}>Change URL</Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 border border-dashed p-6">
                        <Image className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">No logo set</p>
                        <Button variant="outline" size="sm" onClick={() => openForm("editSetting", { key: "site_logo_url", value: "" })}>Add Logo URL</Button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Hero Banner</p>
                    {settings?.site_hero_url ? (
                      <div className="relative overflow-hidden border bg-muted">
                        <img src={settings.site_hero_url} alt="Hero" className="aspect-video w-full object-cover" />
                        <div className="p-2">
                          <Button variant="outline" size="sm" className="w-full" onClick={() => openForm("editSetting", { key: "site_hero_url", value: settings.site_hero_url })}>Change URL</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 border border-dashed p-6">
                        <Image className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">No hero banner</p>
                        <Button variant="outline" size="sm" onClick={() => openForm("editSetting", { key: "site_hero_url", value: "" })}>Add Hero URL</Button>
                      </div>
                    )}
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
            <Dialog open={showForm === "editSetting"} onClose={() => setShowForm(null)} title={`Edit Setting: ${formData.key}`}>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Value for {formData.key}</Label>
                  <Input value={formData.value || ""} onChange={(e) => handleFormChange("value", e.target.value)} />
                </div>
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
                  <Label>Key</Label>
                  <Input value={formData.key || ""} onChange={(e) => handleFormChange("key", e.target.value)} placeholder="setting_key" />
                </div>
                <div className="space-y-1.5">
                  <Label>Value</Label>
                  <Input value={formData.value || ""} onChange={(e) => handleFormChange("value", e.target.value)} placeholder="Value" />
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
