import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { formatDate, formatTime, getMatchStatusColor, formatCurrency } from "@/lib/utils";
import type { Fixture, Standing, Venue, News, Award } from "@/types";
import { Calendar, Trophy, MapPin, Users, ArrowRight, Star, ChevronRight, Medal, Sparkles } from "lucide-react";

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export function HomePage() {
  const navigate = useNavigate();

  const { data: fixtures } = useQuery({ queryKey: ["featured-fixtures"], queryFn: () => api.get<Fixture[]>("/league/fixtures?limit=3") });
  const { data: standings } = useQuery({ queryKey: ["standings"], queryFn: () => api.get<Standing[]>("/league/standings") });
  const { data: venues } = useQuery({ queryKey: ["venues"], queryFn: () => api.get<Venue[]>("/bookings/venues?limit=3") });
  const { data: news } = useQuery({ queryKey: ["news"], queryFn: () => api.get<News[]>("/league/news?limit=3") });
  const { data: awards } = useQuery({ queryKey: ["awards"], queryFn: () => api.get<Award[]>("/league/awards") });

  const items = fixtures?.data || [];
  const standingsList = standings || [];
  const venueList = venues?.data || [];
  const newsList = news?.data || [];
  const awardList = awards || [];

  return (
    <div className="space-y-0">
      {/* ─── Hero Section ─── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-slate-900 to-purple-900" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1577223625816-6500cc85a8b5?w=1920')] bg-cover bg-center opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />

        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24 lg:px-8">
          <motion.div initial="hidden" animate="show" variants={stagger} className="text-center">
            <motion.div variants={fadeUp} className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/80 backdrop-blur-sm">
              <Sparkles className="h-4 w-4 text-yellow-400" /> Season 2025-2026 is live
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
              Where Champions
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"> Are Made</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="mx-auto mt-6 max-w-2xl text-lg text-white/60 sm:text-xl">
              Book premium turfs, compete in the Fusion League, track statistics, and experience football like never before.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button size="lg" className="w-full sm:w-auto gap-2 text-base" onClick={() => navigate("/booking")}>
                <Calendar className="h-5 w-5" /> Book a Turf
              </Button>
              <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10 sm:w-auto" onClick={() => navigate("/league")}>
                <Trophy className="h-5 w-5" /> View League
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── Quick Stats ─── */}
      <section className="relative -mt-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Trophy, label: "Teams", value: "6", color: "text-blue-400" },
              { icon: Users, label: "Active Players", value: "108+", color: "text-green-400" },
              { icon: Calendar, label: "Matches Played", value: "40+", color: "text-purple-400" },
              { icon: MapPin, label: "Turf Venues", value: "1", color: "text-orange-400" },
            ].map((stat) => (
              <motion.div key={stat.label} variants={fadeUp} className="glass rounded-2xl p-6 text-center">
                <stat.icon className={`mx-auto h-8 w-8 ${stat.color}`} />
                <p className="mt-2 text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── Featured Matches ─── */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold sm:text-3xl">Featured Matches</h2>
            <Button variant="ghost" onClick={() => navigate("/league")} className="gap-1">
              View All <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger} className="grid gap-6 md:grid-cols-3">
            {items.map((fixture) => (
              <motion.div key={fixture.id} variants={fadeUp}>
                <Card className="cursor-pointer overflow-hidden transition-all hover:shadow-lg" onClick={() => navigate(`/league/fixtures/${fixture.id}`)}>
                  <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-center text-white">
                    <Badge className={`absolute right-2 top-2 ${getMatchStatusColor(fixture.status)}`}>
                      {fixture.status}
                    </Badge>
                    <p className="text-xs text-white/70">{formatDate(fixture.matchDate)} • {fixture.kickoffTime}</p>
                    <p className="mt-1 text-sm">{fixture.round && `Round ${fixture.round}`}</p>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col items-center gap-1">
                        <img src={fixture.homeTeam.logoUrl || "/placeholder.svg"} alt="" className="h-10 w-10 rounded-full bg-muted" />
                        <span className="text-sm font-medium">{fixture.homeTeam.shortName || fixture.homeTeam.name}</span>
                      </div>
                      <div className="text-center">
                        {fixture.status === "COMPLETED" ? (
                          <span className="text-2xl font-bold">{fixture.homeScore} - {fixture.awayScore}</span>
                        ) : (
                          <span className="text-lg font-bold text-muted-foreground">VS</span>
                        )}
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <img src={fixture.awayTeam.logoUrl || "/placeholder.svg"} alt="" className="h-10 w-10 rounded-full bg-muted" />
                        <span className="text-sm font-medium">{fixture.awayTeam.shortName || fixture.awayTeam.name}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── Standings ─── */}
      <section className="bg-muted/30 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold sm:text-3xl">League Standings</h2>
            <Button variant="ghost" onClick={() => navigate("/league/standings")} className="gap-1">
              Full Table <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-left font-medium">#</th>
                  <th className="p-3 text-left font-medium">Team</th>
                  <th className="p-3 text-center font-medium">P</th>
                  <th className="p-3 text-center font-medium">W</th>
                  <th className="p-3 text-center font-medium">D</th>
                  <th className="p-3 text-center font-medium">L</th>
                  <th className="p-3 text-center font-medium">GD</th>
                  <th className="p-3 text-center font-medium">Pts</th>
                  <th className="p-3 text-center font-medium">Form</th>
                </tr>
              </thead>
              <tbody>
                {standingsList.slice(0, 6).map((s) => (
                  <tr key={s.id} className="border-t transition-colors hover:bg-muted/20 cursor-pointer" onClick={() => navigate(`/league/teams/${s.team.slug}`)}>
                    <td className="p-3 font-medium">{s.position}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <img src={s.team.logoUrl || "/placeholder.svg"} alt="" className="h-6 w-6 rounded-full bg-muted" />
                        <span>{s.team.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-center">{s.played}</td>
                    <td className="p-3 text-center text-green-500">{s.wins}</td>
                    <td className="p-3 text-center text-yellow-500">{s.draws}</td>
                    <td className="p-3 text-center text-red-500">{s.losses}</td>
                    <td className="p-3 text-center">{s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}</td>
                    <td className="p-3 text-center font-bold">{s.points}</td>
                    <td className="p-3 text-center">
                      <div className="flex justify-center gap-0.5">
                        {s.form?.split("").map((r, i) => (
                          <span key={i} className={`inline-block h-4 w-4 rounded-sm text-[10px] leading-4 text-white ${r === "W" ? "bg-green-500" : r === "D" ? "bg-yellow-500" : "bg-red-500"}`}>
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── Book Turf Section ─── */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold sm:text-3xl">Premium Turfs</h2>
            <Button variant="ghost" onClick={() => navigate("/booking")} className="gap-1">
              Book Now <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger} className="grid gap-6 md:grid-cols-3">
            {venueList.map((venue) => (
              <motion.div key={venue.id} variants={fadeUp}>
                <Card className="cursor-pointer overflow-hidden transition-all hover:shadow-lg" onClick={() => navigate(`/booking/${venue.slug}`)}>
                  <div className="aspect-video w-full bg-muted">
                    <img src={venue.coverImage || "/placeholder.svg"} alt={venue.name} className="h-full w-full object-cover" />
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold">{venue.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{venue.city}, {venue.state}</p>
                    <div className="mt-3 flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {venue.turfs?.length || 0} Turfs</span>
                      {venue.avgRating && (
                        <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-yellow-500" /> {venue.avgRating.toFixed(1)}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── Awards ─── */}
      {awardList.length > 0 && (
        <section className="bg-muted/30 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-8 flex items-center justify-between">
              <h2 className="text-2xl font-bold sm:text-3xl">Awards & Recognition</h2>
              <Button variant="ghost" onClick={() => navigate("/league/awards")} className="gap-1">
                View All <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {awardList.slice(0, 4).map((award) => (
                <motion.div key={award.id} variants={fadeUp}>
                  <Card className="text-center transition-all hover:shadow-md">
                    <CardContent className="p-6">
                      <Medal className="mx-auto h-10 w-10 text-yellow-500" />
                      <h3 className="mt-3 font-semibold">{award.name}</h3>
                      {award.winner ? (
                        <p className="mt-1 text-sm text-muted-foreground">{award.winner.firstName} {award.winner.lastName}</p>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">Voting in progress</p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* ─── News ─── */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold sm:text-3xl">Latest News</h2>
            <Button variant="ghost" onClick={() => navigate("/league/news")} className="gap-1">
              All News <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger} className="grid gap-6 md:grid-cols-3">
            {newsList.map((article) => (
              <motion.div key={article.id} variants={fadeUp}>
                <Card className="overflow-hidden transition-all hover:shadow-lg">
                  <div className="aspect-video w-full bg-muted">
                    <img src={article.imageUrl || "/placeholder.svg"} alt="" className="h-full w-full object-cover" />
                  </div>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">{article.publishedAt ? formatDate(article.publishedAt) : ""}</p>
                    <h3 className="mt-1 font-semibold">{article.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{article.excerpt}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="relative overflow-hidden py-16 sm:py-24">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-700" />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-3xl font-bold text-white sm:text-4xl">
              Ready to Play?
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-lg text-white/80">
              Book a turf, join a team, and compete in the most exciting football league.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto gap-2" onClick={() => navigate("/booking")}>
                <Calendar className="h-5 w-5" /> Book a Turf
              </Button>
              <Button size="lg" variant="outline" className="w-full border-white/20 text-white hover:bg-white/10 sm:w-auto gap-2" onClick={() => navigate("/register")}>
                <Users className="h-5 w-5" /> Join the League
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
