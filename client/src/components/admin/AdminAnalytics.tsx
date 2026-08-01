import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";
import { ErrorState } from "@/components/admin/ErrorState";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { Booking, PaginatedResponse } from "@/types";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid, LineChart, Line,
} from "recharts";
import {
  TrendingUp, DollarSign, Calendar, Clock, Building2,
  Users, Repeat, Ban, Percent, MapPin,
} from "lucide-react";

type Period = "today" | "week" | "month" | "year";

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className || ""}`} />;
}

function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: string | number; icon: any; color: string; sub?: string }) {
  return (
    <Card className="overflow-hidden border-none bg-gradient-to-br from-card to-muted/30 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
            {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={`rounded-xl bg-gradient-to-br p-3 shadow-sm ${color.replace("text", "bg").replace("-500", "-500/15")}`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export function AdminAnalytics() {
  const [revenuePeriod, setRevenuePeriod] = useState<Period>("month");
  const [bookingPeriod, setBookingPeriod] = useState<Period>("week");

  const { data: bookingsData, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-bookings-analytics"],
    queryFn: () => api.get<PaginatedResponse<Booking>>("/admin/bookings", { limit: "200" }),
    staleTime: 30000,
    retry: 2,
  });

  const allBookings = bookingsData?.data || [];

  const filterByPeriod = (bookings: Booking[], period: Period): Booking[] => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const thresholds: Record<Period, Date> = {
      today: startOfDay,
      week: startOfWeek,
      month: startOfMonth,
      year: startOfYear,
    };

    const threshold = thresholds[period];
    return bookings.filter((b) => new Date(b.date) >= threshold);
  };

  const periodBookings = useMemo(() => filterByPeriod(allBookings, revenuePeriod), [allBookings, revenuePeriod]);
  const chartBookings = useMemo(() => filterByPeriod(allBookings, bookingPeriod), [allBookings, bookingPeriod]);

  // Revenue only counts bookings that weren't cancelled
  const revenueBookings = useMemo(() => periodBookings.filter((b) => b.status !== "CANCELLED"), [periodBookings]);

  const totalRevenue = useMemo(() =>
    revenueBookings.reduce((sum, b) => sum + b.totalAmount, 0),
    [revenueBookings]
  );

  const totalBookingsCount = periodBookings.length;
  const completedBookings = periodBookings.filter((b) => b.status === "COMPLETED").length;
  const cancelledCount = periodBookings.filter((b) => b.status === "CANCELLED").length;
  const pendingCount = periodBookings.filter((b) => b.status === "PENDING").length;
  const confirmedCount = periodBookings.filter((b) => b.status === "CONFIRMED").length;

  const cancellationRate = totalBookingsCount > 0 ? (cancelledCount / totalBookingsCount * 100).toFixed(1) : "0.0";
  const avgBookingValue = totalBookingsCount > 0 ? totalRevenue / totalBookingsCount : 0;

  const uniqueCustomers = new Set(periodBookings.map((b) => b.userId)).size;
  const repeatCustomers = periodBookings.length > 0
    ? periodBookings.filter((b) => periodBookings.some((bb) => bb.userId === b.userId && bb.id !== b.id)).length
    : 0;
  const repeatRate = periodBookings.length > 0 ? ((repeatCustomers / periodBookings.length) * 100).toFixed(1) : "0.0";

  const venueBookings = useMemo(() => {
    const map = new Map<string, { name: string; count: number; revenue: number }>();
    periodBookings.forEach((b) => {
      const name = b.turf?.venue?.name || "Unknown";
      const existing = map.get(name) || { name, count: 0, revenue: 0 };
      existing.count++;
      if (b.status !== "CANCELLED") existing.revenue += b.totalAmount;
      map.set(name, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [periodBookings]);

  const popularVenue = venueBookings[0];

  const peakHours = useMemo(() => {
    const hourMap = new Map<number, number>();
    periodBookings.forEach((b) => {
      const startH = parseInt(b.startTime.split(":")[0]);
      hourMap.set(startH, (hourMap.get(startH) || 0) + 1);
    });
    return Array.from(hourMap.entries())
      .map(([hour, count]) => ({ hour: hour > 12 ? hour - 12 : hour, label: `${hour > 12 ? hour - 12 : hour}${hour >= 12 ? "p" : "a"}`, count }))
      .sort((a, b) => a.hour - b.hour);
  }, [periodBookings]);

  const dailyChartData = useMemo(() => {
    const map = new Map<string, { date: string; revenue: number; bookings: number }>();
    chartBookings.forEach((b) => {
      const key = b.date.split("T")[0];
      const existing = map.get(key) || { date: key, revenue: 0, bookings: 0 };
      if (b.status !== "CANCELLED") existing.revenue += b.totalAmount;
      existing.bookings++;
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [chartBookings]);

  const hourlyChartData = useMemo(() => {
    const map = new Map<number, { hour: number; label: string; bookings: number }>();
    for (let h = 6; h <= 23; h++) {
      map.set(h, { hour: h, label: `${h > 12 ? h - 12 : h}${h >= 12 ? "p" : "a"}`, bookings: 0 });
    }
    chartBookings.forEach((b) => {
      const h = parseInt(b.startTime.split(":")[0]);
      const existing = map.get(h);
      if (existing) existing.bookings++;
    });
    return Array.from(map.values());
  }, [chartBookings]);

  const monthlyChartData = useMemo(() => {
    const map = new Map<string, { month: string; revenue: number; bookings: number }>();
    chartBookings.forEach((b) => {
      const d = new Date(b.date);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      const label = MONTHS[d.getMonth()].slice(0, 3);
      const existing = map.get(key) || { month: label, revenue: 0, bookings: 0 };
      if (b.status !== "CANCELLED") existing.revenue += b.totalAmount;
      existing.bookings++;
      map.set(key, existing);
    });
    return Array.from(map.values());
  }, [chartBookings]);

  const occupancyHeatmap = useMemo(() => {
    const grid: { day: string; hour: number; count: number }[] = [];
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (const day of days) {
      for (let h = 6; h <= 23; h++) {
        grid.push({ day, hour: h, count: 0 });
      }
    }
    chartBookings.forEach((b) => {
      const d = new Date(b.date);
      const day = days[d.getDay()];
      const h = parseInt(b.startTime.split(":")[0]);
      const cell = grid.find((g) => g.day === day && g.hour === h);
      if (cell) cell.count++;
    });
    return grid;
  }, [chartBookings]);

  if (isError) {
    return (
      <Card className="border-destructive/20">
        <CardContent>
          <ErrorState message="Couldn't load analytics." onRetry={refetch} />
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Revenue Stats */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Analytics
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Revenue:</span>
            {(["today", "week", "month", "year"] as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setRevenuePeriod(p)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  revenuePeriod === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1,2,3,4].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Revenue" value={formatCurrency(totalRevenue)} icon={DollarSign} color="text-green-500" sub={`${totalBookingsCount} bookings`} />
            <StatCard label="Avg Booking Value" value={formatCurrency(Math.round(avgBookingValue))} icon={TrendingUp} color="text-blue-500" />
            <StatCard label="Cancellation Rate" value={`${cancellationRate}%`} icon={Ban} color="text-red-500" sub={`${cancelledCount} cancelled`} />
            <StatCard label="Repeat Rate" value={`${repeatRate}%`} icon={Repeat} color="text-purple-500" sub={`${uniqueCustomers} unique customers`} />
          </div>
        )}
      </motion.div>

      {/* Booking Graphs */}
      <motion.div variants={item} className="grid gap-6 lg:grid-cols-2">
        {/* Hourly Bookings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4" /> Hourly Bookings
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="bookings" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Daily/Monthly Trend */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4" /> Booking Trend
            </CardTitle>
            <div className="flex gap-1">
              {(["week", "month", "year"] as Period[]).filter((p) => p !== "today").map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setBookingPeriod(p)}
                  className={`rounded-md px-2 py-1 text-[10px] font-medium transition ${
                    bookingPeriod === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="h-64">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={bookingPeriod === "month" ? monthlyChartData : dailyChartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey={bookingPeriod === "month" ? "month" : "date"}
                    tick={{ fontSize: 10 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(val) => bookingPeriod === "month" ? val : val?.slice(5) || ""}
                  />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Area type="monotone" dataKey="bookings" stroke="hsl(var(--primary))" fill="url(#colorRevenue)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={item} className="grid gap-6 lg:grid-cols-3">
        {/* Occupancy Heatmap */}
        <Card className="lg:col-span-2">
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4" /> Occupancy Heatmap
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <div className="min-w-[600px]">
                <div className="flex text-[10px] text-muted-foreground">
                  <div className="w-10 shrink-0" />
                  {Array.from({ length: 12 }, (_, i) => i + 6).map((h) => (
                    <div key={h} className="flex-1 text-center font-medium">
                      {h > 12 ? h - 12 : h}
                    </div>
                  ))}
                  <div className="w-10 shrink-0" />
                </div>
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                  <div key={day} className="flex items-center">
                    <div className="w-10 shrink-0 text-[10px] text-muted-foreground font-medium">{day}</div>
                    {Array.from({ length: 12 }, (_, i) => i + 6).map((h) => {
                      const cell = occupancyHeatmap.find((c) => c.day === day && c.hour === h);
                      const count = cell?.count || 0;
                      const intensity = Math.min(count / 5, 1);
                      return (
                        <div
                          key={`${day}-${h}`}
                          className="m-px flex-1 rounded-sm"
                          style={{
                            height: 28,
                            backgroundColor: count > 0
                              ? `hsl(var(--primary) / ${0.1 + intensity * 0.7})`
                              : "hsl(var(--muted))",
                          }}
                          title={`${day} ${h}:00 – ${count} bookings`}
                        />
                      );
                    })}
                    <div className="w-10 shrink-0 text-right text-[10px] text-muted-foreground font-medium">{day}</div>
                  </div>
                ))}
                <div className="mt-2 flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
                  <span>Low</span>
                  <div className="flex gap-0.5">
                    {[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => (
                      <div key={v} className="h-3 w-3 rounded-sm" style={{ backgroundColor: `hsl(var(--primary) / ${v})` }} />
                    ))}
                  </div>
                  <span>High</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Popular Venues + Peak Hours */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4" /> Popular Venues
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : venueBookings.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-muted-foreground">
                <MapPin className="mb-2 h-6 w-6" />
                <p className="text-sm">No data</p>
              </div>
            ) : (
              <div className="space-y-3">
                {venueBookings.slice(0, 6).map((v, i) => (
                  <div key={v.name} className="flex items-center gap-3">
                    <span className="w-5 text-xs font-bold text-muted-foreground">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{v.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{v.count} booking{v.count > 1 ? "s" : ""}</span>
                        <span>•</span>
                        <span>{formatCurrency(v.revenue)}</span>
                      </div>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {((v.count / totalBookingsCount) * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Peak Hours + Status Breakdown */}
      <motion.div variants={item} className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4" /> Peak Hours
            </CardTitle>
          </CardHeader>
          <CardContent className="h-48">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={peakHours}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Percent className="h-4 w-4" /> Booking Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[1,2,3,4].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : (
              <div className="space-y-3">
                <StatusBar label="Confirmed" count={confirmedCount} total={totalBookingsCount} color="bg-blue-500" />
                <StatusBar label="Completed" count={completedBookings} total={totalBookingsCount} color="bg-green-500" />
                <StatusBar label="Pending" count={pendingCount} total={totalBookingsCount} color="bg-amber-500" />
                <StatusBar label="Cancelled" count={cancelledCount} total={totalBookingsCount} color="bg-red-500" />
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function StatusBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{count} ({pct.toFixed(0)}%)</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </div>
  );
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
