import { useMemo } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { DashboardStats, Booking, ActivityLog, Fixture } from "@/types";
import {
  DollarSign, Calendar, Building2, Wallet, Clock, ArrowRight,
  Plus, Users, Trophy, Activity, MapPin, UserPlus,
} from "lucide-react";

function StatCard({ label, value, icon: Icon, color, isLoading }: { label: string; value: string | number; icon: any; color: string; isLoading?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className="overflow-hidden border-none bg-gradient-to-br from-card to-muted/30 shadow-sm">
        <CardContent className="p-5">
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              <div className="h-7 w-24 animate-pulse rounded bg-muted" />
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
              </div>
              <div className={`rounded-xl bg-gradient-to-br p-3 shadow-sm ${color.replace("text", "bg").replace("-500", "-500/15")}`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className || ""}`} />;
}

export function AdminDashboard() {
  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => api.get<DashboardStats>("/admin/dashboard"),
    retry: 1,
    staleTime: 30000,
  });

  const { data: bookingsData, isLoading: bookingsLoading } = useQuery({
    queryKey: ["admin-bookings"],
    queryFn: () => api.get<{ data: Booking[] }>("/admin/bookings", { limit: "10" }),
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ["admin-activity"],
    queryFn: () => api.get<{ data: ActivityLog[] }>("/admin/activity-logs", { limit: "10" }),
  });

  const { data: fixturesData, isLoading: fixturesLoading } = useQuery({
    queryKey: ["admin-fixtures-today"],
    queryFn: () => api.get<{ data: Fixture[] }>("/admin/fixtures/live", { limit: "10" }),
  });

  const stats = dashboard?.stats;

  const todayBookings = useMemo(() =>
    (bookingsData?.data || []).filter((b) => {
      const today = new Date().toISOString().split("T")[0];
      return b.date?.startsWith(today);
    }),
    [bookingsData]
  );

  const pendingPayments = useMemo(() =>
    (bookingsData?.data || []).filter((b) => b.status === "PENDING"),
    [bookingsData]
  );

  const logs = logsData?.data || [];
  const recentFixtures = dashboard?.recentFixtures || [];

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };

  const item = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Stats Row */}
      <motion.div variants={item} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue Today" value={stats?.totalRevenue ? formatCurrency(stats.totalRevenue) : "—"} icon={DollarSign} color="text-green-500" isLoading={dashLoading} />
        <StatCard label="Bookings Today" value={todayBookings.length || "—"} icon={Calendar} color="text-blue-500" isLoading={bookingsLoading} />
        <StatCard label="Occupancy" value="—" icon={Building2} color="text-purple-500" isLoading={false} />
        <StatCard label="Pending Payments" value={pendingPayments.length || "—"} icon={Wallet} color="text-amber-500" isLoading={bookingsLoading} />
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today's Schedule + Recent Bookings */}
        <motion.div variants={item} className="space-y-6 lg:col-span-2">
          {/* Today's Schedule */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4" /> Today's Schedule</CardTitle>
              <Badge variant="outline" className="text-xs">{new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</Badge>
            </CardHeader>
            <CardContent>
              {fixturesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : recentFixtures.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <Calendar className="mb-2 h-8 w-8" />
                  <p className="text-sm">No fixtures scheduled today</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentFixtures.slice(0, 5).map((f) => (
                    <div key={f.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm transition hover:bg-muted/30">
                      <div className="w-14 text-xs font-medium text-muted-foreground">
                        {f.matchDate ? new Date(f.matchDate).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </div>
                      <div className="flex flex-1 items-center gap-2">
                        <span className="font-medium">{f.homeTeam?.shortName || f.homeTeam?.name || "?"}</span>
                        <span className="text-xs text-muted-foreground">vs</span>
                        <span className="font-medium">{f.awayTeam?.shortName || f.awayTeam?.name || "?"}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">{f.status === "COMPLETED" ? "Full time" : f.status === "LIVE" ? "Live" : "Scheduled"}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Bookings */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base"><Calendar className="h-4 w-4" /> Recent Bookings</CardTitle>
              <Badge variant="outline" className="text-xs">Today: {todayBookings.length}</Badge>
            </CardHeader>
            <CardContent>
              {bookingsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : bookingsData?.data?.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <Calendar className="mb-2 h-8 w-8" />
                  <p className="text-sm">No bookings yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="pb-2 font-medium">Customer</th>
                        <th className="pb-2 font-medium">Venue</th>
                        <th className="pb-2 font-medium">Time</th>
                        <th className="pb-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(bookingsData?.data || []).slice(0, 6).map((b) => (
                        <tr key={b.id} className="border-b last:border-0 transition hover:bg-muted/20">
                          <td className="py-2.5 pr-3">
                            <span className="font-medium">{b.user?.firstName} {b.user?.lastName}</span>
                          </td>
                          <td className="py-2.5 pr-3 text-muted-foreground">{b.turf?.venue?.name || "—"}</td>
                          <td className="py-2.5 pr-3 text-muted-foreground">{b.startTime}–{b.endTime}</td>
                          <td className="py-2.5">
                            <Badge variant={b.status === "CONFIRMED" ? "default" : b.status === "PENDING" ? "outline" : "secondary"} className="text-xs">
                              {b.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Right Column: Quick Actions + Timeline */}
        <motion.div variants={item} className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ArrowRight className="h-4 w-4" /> Quick Actions</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              <Button variant="outline" className="justify-start gap-2" onClick={() => {}}><Plus className="h-4 w-4" /> Booking</Button>
              <Button variant="outline" className="justify-start gap-2" onClick={() => {}}><Users className="h-4 w-4" /> Team</Button>
              <Button variant="outline" className="justify-start gap-2" onClick={() => {}}><UserPlus className="h-4 w-4" /> Player</Button>
              <Button variant="outline" className="justify-start gap-2" onClick={() => {}}><Activity className="h-4 w-4" /> Fixture</Button>
              <Button variant="outline" className="justify-start gap-2" onClick={() => {}}><MapPin className="h-4 w-4" /> Venue</Button>
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4" /> Activity Timeline</CardTitle></CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <Clock className="mb-2 h-8 w-8" />
                  <p className="text-sm">No recent activity</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {logs.slice(0, 8).map((log, i) => (
                    <div key={log.id} className="relative flex gap-3 pb-4 last:pb-0">
                      {i < logs.length - 1 && i < 7 && (
                        <div className="absolute left-[7px] top-4 h-full w-px bg-border" />
                      )}
                      <div className={`mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
                        log.action?.includes("created") || log.action?.includes("booked")
                          ? "border-green-500 bg-green-500/20"
                          : log.action?.includes("updated") || log.action?.includes("paid")
                          ? "border-blue-500 bg-blue-500/20"
                          : "border-muted-foreground bg-muted"
                      }`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{log.action} {log.entity && <span className="text-muted-foreground">{log.entity}</span>}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.createdAt ? formatDate(log.createdAt) : "—"}
                          {log.user && ` by ${log.user.firstName} ${log.user.lastName}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
