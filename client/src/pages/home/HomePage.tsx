import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/utils";
import type { Fixture, Standing, Venue, News, PaginatedResponse, Sponsor, Season } from "@/types";
import { Calendar, Trophy, MapPin, Star, ArrowUpRight, Flame, Target } from "lucide-react";
import { LeagueHero, LeagueCard, LeagueEmptyState, SectionLink } from "@/components/league/LeagueUI";

export function HomePage() {
  const navigate = useNavigate();

  const { data: settings } = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => api.get<Record<string, string>>("/settings"),
    retry: false,
  });

  const { data: fixtures } = useQuery({ queryKey: ["featured-fixtures"], queryFn: () => api.get<PaginatedResponse<Fixture>>("/league/fixtures?limit=6"), staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 15000 });
  const { data: standings } = useQuery({ queryKey: ["standings"], queryFn: () => api.get<Standing[]>("/league/standings"), staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 10000 });
  const { data: venues } = useQuery({ queryKey: ["venues"], queryFn: () => api.get<PaginatedResponse<Venue>>("/bookings/venues?limit=4"), refetchOnWindowFocus: true, refetchInterval: 60000 });
  const { data: news } = useQuery({ queryKey: ["home-news"], queryFn: () => api.get<PaginatedResponse<News>>("/league/news?limit=4"), refetchOnWindowFocus: true, refetchInterval: 60000 });
  const { data: sponsors } = useQuery({ queryKey: ["sponsors"], queryFn: () => api.get<{ data: Sponsor[] }>("/league/sponsors"), refetchOnWindowFocus: true, refetchInterval: 60000 });
  const { data: currentSeason } = useQuery({ queryKey: ["current-season"], queryFn: () => api.get<Season>("/league/seasons/current"), retry: false, refetchOnWindowFocus: true, refetchInterval: 60000 });

  const heroImage = settings?.site_hero_url || "/hero.jpeg";
  const itemList = fixtures?.data || [];
  const standingsList = standings || [];
  const venueList = venues?.data || [];
  const newsList = news?.data || [];
  const sponsorList = sponsors?.data || [];

  return (
    <div className="space-y-24 pb-8">
      {/* Hero */}
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <LeagueHero
          image={heroImage}
          eyebrow={<><Flame className="h-3.5 w-3.5" /> {currentSeason?.name || "Current season"}</>}
          title={<>The league, the venues, and the moments that matter</>}
          subtitle="Reserve Fusion football turf, or join the league, follow live standings and never miss a match."
          actions={(
            <>
              <Button size="lg" className="gap-2" onClick={() => navigate("/booking")}><Calendar className="h-5 w-5" /> Book Turf</Button>
              <Button size="lg" variant="secondary" className="gap-2" onClick={() => navigate("/league")}><Trophy className="h-5 w-5" /> Explore League</Button>
            </>
          )}
        />
      </div>

      {/* Available Turfs */}
      {venueList.length > 0 && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <LeagueCard title="Available Turfs" action={<SectionLink onClick={() => navigate("/booking")}>Book now</SectionLink>}>
            <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
              {venueList.map((venue) => (
                <Card key={venue.id} className="cursor-pointer overflow-hidden border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" onClick={() => navigate(`/booking/${venue.slug}`)}>
                  <div className="aspect-[4/3] bg-muted">
                    <img src={venue.coverImage || "/placeholder.svg"} alt={venue.name} className="h-full w-full object-cover" />
                  </div>
                  <CardContent className="space-y-2 p-4">
                    <p className="text-sm font-semibold">{venue.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{venue.address || venue.city}{venue.state ? `, ${venue.state}` : ""}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {venue.address || venue.city}</span>
                      {venue.avgRating != null && <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 text-yellow-500" /> {venue.avgRating.toFixed(1)}</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </LeagueCard>
        </div>
      )}

      {/* Today's Matches */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <LeagueCard
          title="Today's Matches"
          action={<SectionLink onClick={() => navigate("/league/fixtures")}>All fixtures</SectionLink>}
        >
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {itemList.slice(0, 4).map((fixture) => (
              <Card key={fixture.id} className="overflow-hidden border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{fixture.status}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(fixture.matchDate)} {fixture.kickoffTime ? `• ${formatTime(fixture.kickoffTime)}` : ""}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <img src={fixture.homeTeam.logoUrl || "/placeholder.svg"} alt="" className="h-11 w-11 rounded-full bg-muted object-cover" />
                      <p className="text-sm font-medium">{fixture.homeTeam.shortName || fixture.homeTeam.name}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold tabular-nums">
                        {fixture.status === "COMPLETED" ? `${fixture.homeScore ?? 0}-${fixture.awayScore ?? 0}` : "VS"}
                      </p>
                      {fixture.round ? <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Round {fixture.round}</p> : null}
                    </div>
                    <div className="flex flex-col items-center gap-2 text-center">
                      <img src={fixture.awayTeam.logoUrl || "/placeholder.svg"} alt="" className="h-11 w-11 rounded-full bg-muted object-cover" />
                      <p className="text-sm font-medium">{fixture.awayTeam.shortName || fixture.awayTeam.name}</p>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full gap-2" onClick={() => navigate(`/league/fixtures/${fixture.id}`)}>
                    Open match <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </LeagueCard>
      </div>

      {/* League Table */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <LeagueCard
          title="League Table"
          action={<SectionLink onClick={() => navigate("/league/standings")}>Full table</SectionLink>}
        >
          <div className="p-4">
            {standingsList.slice(0, 5).length > 0 ? (
              <div className="space-y-2">
                {standingsList.slice(0, 5).map((row) => (
                  <button
                    key={row.id}
                    onClick={() => navigate(`/league/teams/${row.team.slug}`)}
                    className="flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition hover:bg-secondary/60"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">#{row.position}</span>
                    <img src={row.team.logoUrl || "/placeholder.svg"} alt="" className="h-8 w-8 rounded-full bg-muted object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{row.team.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.played} played • {row.goalDifference >= 0 ? `+${row.goalDifference}` : row.goalDifference} GD
                      </p>
                    </div>
                    <Badge variant="secondary" className="rounded-full">{row.points} pts</Badge>
                  </button>
                ))}
              </div>
            ) : (
              <LeagueEmptyState
                title="No standings yet"
                description="The table will populate once league results are available."
              />
            )}
          </div>
        </LeagueCard>
      </div>

      {/* Latest News */}
      {newsList.length > 0 && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <LeagueCard title="Latest News" action={<SectionLink onClick={() => navigate("/league/news")}>All news</SectionLink>}>
            <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
              {newsList.map((article) => (
                <Card key={article.id} className="overflow-hidden border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="aspect-video bg-muted">
                    <img src={article.imageUrl || "/placeholder.svg"} alt="" className="h-full w-full object-cover" />
                  </div>
                  <CardContent className="space-y-2 p-4">
                    <p className="text-xs text-muted-foreground">{article.publishedAt ? formatDate(article.publishedAt) : "Recently"}</p>
                    <h3 className="line-clamp-2 text-sm font-semibold">{article.title}</h3>
                    <p className="line-clamp-3 text-sm text-muted-foreground">{article.excerpt}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </LeagueCard>
        </div>
      )}

      {/* Sponsors */}
      {sponsorList.length > 0 && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Card className="border bg-card/70 shadow-sm">
            <CardContent className="flex flex-wrap items-center justify-center gap-6 px-6 py-6">
              {sponsorList.map((sponsor) => (
                <a key={sponsor.id} href={sponsor.website || "#"} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground">
                  <img src={sponsor.logoUrl} alt={sponsor.name} className="h-8 w-auto max-w-[120px] object-contain" />
                  <span>{sponsor.name}</span>
                </a>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Footer CTA */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#0a1838,#0e4f3a)] p-8 text-white shadow-lg sm:p-10">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white/80">
                <Flame className="h-3.5 w-3.5" /> Matchday ready
              </div>
              <h2 className="text-3xl font-bold sm:text-4xl">One place for the whole season.</h2>
              <p className="mt-3 max-w-2xl text-sm text-white/75 sm:text-base">
                Follow the table, jump into a fixture, inspect a team, or book a ground without bouncing between disconnected pages.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" variant="secondary" className="gap-2" onClick={() => navigate("/league/fixtures")}>
                <Target className="h-5 w-5" /> Fixtures
              </Button>
              <Button size="lg" variant="outline" className="gap-2 border-white/20 text-white hover:bg-white/10" onClick={() => navigate("/league/standings")}>
                <Trophy className="h-5 w-5" /> Standings
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
