import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { ErrorState } from "@/components/admin/ErrorState";
import { ActivityFeed } from "@/components/admin/ActivityFeed";
import type { DashboardStats, Booking } from "@/types";
import { businessDateKey, fixtureDateKey, isActiveMatch } from "@/lib/fixtures";
import {
  DollarSign, Calendar, Building2, Wallet, Clock, Trophy,
  MapPin, Users, XCircle, UserPlus,
} from "lucide-react";

type Period = "today" | "week" | "month" | "year";

const periodLabels: Record<Period, string> = {
  today: "Today", week: "This Week", month: "This Month", year: "This Year",
};

function StatCard({ label, value, icon: Icon, color, isLoading, index = 0 }: {
  label: string; value: string | number; icon: any; color: string; isLoading?: boolean; index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card className="overflow-hidden border-none bg-gradient-to-br from-card to-muted/30 shadow-sm hover:shadow-md transition-shadow">
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
  const [period, setPeriod] = useState<Period>("today");

  const { data: dashboard, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-dashboard", period],
    queryFn: () => api.get<DashboardStats>("/admin/dashboard", { period }),
    retry: 1,
    staleTime: 30000,
  });

  const stats = dashboard?.stats;
  const periodStats = dashboard?.periodStats;
  const recentFixtures = dashboard?.recentFixtures || [];
  const todayFixtures = dashboard?.todayFixtures || [];
  const recentBookings = dashboard?.recentBookings || [];
  const venues = dashboard?.venues || [];

  const todayStr = businessDateKey();

  const todayBookings = recentBookings.filter((b) => b.date?.startsWith(todayStr));
  const pendingPayments = recentBookings.filter((b) => b.status === "PENDING");
  const cancelledToday = recentBookings.filter((b) => b.date?.startsWith(todayStr) && b.status === "CANCELLED");
  const upcomingMatches = recentFixtures.filter((f) => f.status === "SCHEDULED");
  const totalVenues = venues.length;

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };

  const item = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0 },
  };

  const todaySchedule = todayFixtures.filter((fixture) => fixtureDateKey(fixture) === todayStr);

  if (isError) {
    return (
      <Card className="border-destructive/20">
        <CardContent>
          <ErrorState message={`Couldn't load dashboard. ${(error as any)?.message || ""}`} onRetry={refetch} />
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Period Selector */}
      <motion.div variants={item} className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Period:</span>
        {(["today", "week", "month", "year"] as Period[]).map((p) => (
          <Button
            key={p}
            variant={period === p ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod(p)}
            className="h-8 px-3 text-xs"
          >
            {periodLabels[p]}
          </Button>
        ))}
      </motion.div>

      {/* 8 Stat Cards */}
      <motion.div variants={item} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={`${periodLabels[period]} Revenue`} value={formatCurrency(periodStats?.revenue || 0)} icon={DollarSign} color="text-green-500" isLoading={isLoading} index={0} />
        <StatCard label={`${periodLabels[period]} Bookings`} value={periodStats?.bookings ?? todayBookings.length} icon={Calendar} color="text-blue-500" isLoading={isLoading} index={1} />
        <StatCard label="Current Occupancy" value={stats?.activeBookings ? `${Math.min(Math.round((stats.activeBookings / 20) * 100), 100)}%` : "—"} icon={Building2} color="text-purple-500" isLoading={isLoading} index={2} />
        <StatCard label="Pending Payments" value={pendingPayments.length} icon={Wallet} color="text-amber-500" isLoading={isLoading} index={3} />
        <StatCard label="Upcoming Matches" value={upcomingMatches.length} icon={Trophy} color="text-orange-500" isLoading={isLoading} index={4} />
        <StatCard label="Available Venues" value={venues.length} icon={MapPin} color="text-teal-500" isLoading={isLoading} index={5} />
        <StatCard label={`Cancelled (${periodLabels[period]})`} value={period === "today" ? cancelledToday.length : periodStats?.cancellations ?? 0} icon={XCircle} color="text-red-500" isLoading={isLoading} index={6} />
        <StatCard label="All-time Users" value={stats?.totalUsers || 0} icon={UserPlus} color="text-pink-500" isLoading={isLoading} index={7} />
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Schedule + Bookings */}
        <motion.div variants={item} className="space-y-6 lg:col-span-2">
          {/* Today's Schedule */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4" /> Today's Schedule</CardTitle>
              <Badge variant="outline" className="text-xs">{formatDate(todayStr, { weekday: "short" })}</Badge>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : todaySchedule.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <Calendar className="mb-2 h-8 w-8" />
                  <p className="text-sm">No fixtures scheduled today</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todaySchedule.map((f) => (
                    <div key={f.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm transition hover:bg-muted/30">
                      <div className="w-14 text-xs font-medium text-muted-foreground">
                        {f.kickoffTime ? formatTime(f.kickoffTime) : "TBD"}
                      </div>
                      <div className="flex flex-1 items-center gap-2">
                        <span className="font-medium">{f.homeTeam?.shortName || f.homeTeam?.name || "?"}</span>
                        <span className="text-xs text-muted-foreground">vs</span>
                        <span className="font-medium">{f.awayTeam?.shortName || f.awayTeam?.name || "?"}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">{f.status === "COMPLETED" ? "Full time" : isActiveMatch(f.status) ? f.status.replace(/_/g, " ") : "Scheduled"}</Badge>
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
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : recentBookings.length === 0 ? (
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
                      {recentBookings.slice(0, 6).map((b) => (
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

        {/* Right: Activity Feed */}
        <motion.div variants={item}>
          <ActivityFeed />
        </motion.div>
      </div>
    </motion.div>
  );
}
