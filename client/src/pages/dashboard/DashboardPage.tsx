import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { formatDate, formatCurrency, getMatchStatusColor } from "@/lib/utils";
import type { Booking, DashboardStats } from "@/types";
import { Calendar, Clock, MapPin, CreditCard, User, Settings, ArrowRight, Bell, Heart, Trophy, BarChart3 } from "lucide-react";

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const { data: bookings } = useQuery({
    queryKey: ["my-bookings"],
    queryFn: () => api.get<{ data: Booking[] }>("/bookings/my", { limit: "10" }),
    enabled: !!user,
  });

  const bookingList = bookings?.data || [];

  const { data: fanData } = useQuery({
    queryKey: ["fan-dashboard"],
    queryFn: () => api.get<any>("/league/fan/dashboard"),
    enabled: !!user,
  });

  useEffect(() => {
    if (user && "Notification" in window && Notification.permission === "default") Notification.requestPermission();
  }, [user]);

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Sign in required</h1>
        <p className="mt-2 text-muted-foreground">Please sign in to view your dashboard.</p>
        <Button className="mt-4" onClick={() => navigate("/")}>Go Home</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Welcome, {user.firstName}</h1>
            <p className="text-muted-foreground">Your bookings, followed football, and matchday updates</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{user.role.replace("_", " ")}</Badge>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Heart className="h-4 w-4 text-rose-500" /> Your football</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {!fanData?.follows?.length ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Follow a team or player to personalize this space.</div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">{fanData.follows.map((f: any) => <Badge key={f.id} variant="secondary">{f.team?.name || `${f.player?.firstName} ${f.player?.lastName}`}</Badge>)}</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(fanData.upcoming || []).slice(0, 4).map((fixture: any) => <button key={fixture.id} onClick={() => navigate(`/league/fixtures/${fixture.id}`)} className="rounded-xl border p-3 text-left hover:bg-secondary/50"><p className="text-xs text-muted-foreground">{formatDate(fixture.matchDate)} · {fixture.kickoffTime || "TBD"}</p><p className="mt-1 font-medium">{fixture.homeTeam.shortName || fixture.homeTeam.name} <span className="text-muted-foreground">vs</span> {fixture.awayTeam.shortName || fixture.awayTeam.name}</p></button>)}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4" /> Notifications</CardTitle></CardHeader>
            <CardContent className="space-y-3">{(fanData?.notifications || []).slice(0, 4).map((n: any) => <div key={n.id} className="border-b pb-3 last:border-0"><p className="text-sm font-medium">{n.title}</p><p className="text-xs text-muted-foreground">{n.message}</p></div>)}{!fanData?.notifications?.length && <p className="text-sm text-muted-foreground">No match updates yet.</p>}</CardContent>
          </Card>
        </div>

        {fanData?.standings?.length > 0 && <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-4 w-4" /> Followed teams</CardTitle></CardHeader><CardContent className="space-y-2">{fanData.standings.map((row: any) => <div key={row.id} className="flex items-center gap-3 rounded-lg border p-3"><span className="font-bold text-primary">#{row.position}</span><span className="flex-1 font-medium">{row.team.name}</span><Badge>{row.points} pts</Badge></div>)}</CardContent></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Followed player stats</CardTitle></CardHeader><CardContent className="space-y-2">{(fanData.playerStats || []).slice(0, 5).map((s: any) => <div key={s.id} className="flex items-center gap-3 rounded-lg border p-3"><span className="flex-1 font-medium">{s.player.firstName} {s.player.lastName}</span><span className="text-sm">{s.goals} goals</span><span className="text-sm text-muted-foreground">{s.assists} assists</span></div>)}</CardContent></Card>
        </div>}

        <div className="grid gap-6 md:grid-cols-3">
          {/* Quick Stats */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Bookings</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{bookingList.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Role</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold capitalize">{user.role.toLowerCase().replace("_", " ")}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Member Since</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold text-sm">{formatDate(user.createdAt)}</p></CardContent>
          </Card>
        </div>

        {/* Bookings */}
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">My Bookings</h2>
            <Button variant="outline" size="sm" onClick={() => navigate("/booking")}>Book a Turf</Button>
          </div>

          {bookingList.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-lg font-medium">No bookings yet</p>
                <p className="text-sm text-muted-foreground">Book your first turf now!</p>
                <Button className="mt-4" onClick={() => navigate("/booking")}>Book Now</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {bookingList.map((booking) => (
                <Card key={booking.id}>
                  <CardContent className="flex items-start justify-between p-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{booking.turf.venue.name}</p>
                        <Badge variant={booking.status === "CONFIRMED" ? "default" : booking.status === "CANCELLED" ? "destructive" : "secondary"}>
                          {booking.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {formatDate(booking.date)}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {booking.startTime} - {booking.endTime}</span>
                        <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {booking.turf.name}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">Booking #{booking.bookingNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{formatCurrency(booking.totalAmount)}</p>
                      {booking.payments?.map((p) => (
                        <p key={p.id} className="text-sm text-muted-foreground">{p.status}</p>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Profile Info */}
        <div className="mt-8">
          <h2 className="mb-4 text-xl font-bold">Profile</h2>
          <Card>
            <CardContent className="p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{user.firstName} {user.lastName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{user.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{user.phone || "Not provided"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Role</p>
                  <p className="font-medium">{user.role.replace("_", " ")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
  );
}
