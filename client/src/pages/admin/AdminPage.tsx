import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { DashboardStats, User } from "@/types";
import {
  LayoutDashboard, Users, Calendar, Trophy, Settings,
  BarChart3, Activity, Bell, DollarSign, LogOut
} from "lucide-react";

const adminTabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "seasons", label: "Seasons", icon: Calendar },
  { id: "teams", label: "Teams", icon: Trophy },
  { id: "players", label: "Players", icon: Users },
  { id: "fixtures", label: "Fixtures", icon: Activity },
  { id: "awards", label: "Awards", icon: Trophy },
  { id: "bookings", label: "Bookings", icon: Calendar },
  { id: "users", label: "Users", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
];

export function AdminPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: dashboard } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => api.get<DashboardStats>("/admin/dashboard"),
  });

  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api.get<{ data: User[] }>("/admin/users", { limit: "20" }),
  });

  if (!user || !["SUPER_ADMIN", "LEAGUE_ADMIN", "BOOKING_MANAGER"].includes(user.role)) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="mt-2 text-muted-foreground">You do not have permission to access this page.</p>
        <Button className="mt-4" onClick={() => navigate("/")}>Go Home</Button>
      </div>
    );
  }

  const stats = dashboard?.stats;
  const userList = users?.data || [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage Fusion League platform</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">{user.role.replace("_", " ")}</Badge>
            <Button variant="ghost" size="icon" onClick={logout}><LogOut className="h-5 w-5" /></Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {adminTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
                activeTab === tab.id ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"
              }`}
            >
              <tab.icon className="h-4 w-4" /> {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
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
                      <span>{f.homeTeam.shortName} vs {f.awayTeam.shortName}</span>
                      <Badge variant="secondary">{f.status}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
                <CardContent className="grid gap-2">
                  <Button variant="outline" className="justify-start" onClick={() => navigate("/booking")}>
                    <Calendar className="mr-2 h-4 w-4" /> View Bookings
                  </Button>
                  <Button variant="outline" className="justify-start" onClick={() => navigate("/league")}>
                    <Trophy className="mr-2 h-4 w-4" /> Manage League
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Users Tab */}
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
                    {userList.map((u) => (
                      <tr key={u.id} className="border-t">
                        <td className="p-3">{u.firstName} {u.lastName}</td>
                        <td className="p-3 text-muted-foreground">{u.email}</td>
                        <td className="p-3"><Badge variant="secondary">{u.role.replace("_", " ")}</Badge></td>
                        <td className="p-3">
                          <Badge variant={u.isActive ? "default" : "destructive"}>
                            {u.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">{formatDate(u.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Placeholder for other tabs */}
        {activeTab !== "overview" && activeTab !== "users" && (
          <Card>
            <CardContent className="flex flex-col items-center py-16">
              <Settings className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-medium">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Management</h3>
              <p className="text-sm text-muted-foreground">Full management interface coming soon. Use the API for now.</p>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  );
}
