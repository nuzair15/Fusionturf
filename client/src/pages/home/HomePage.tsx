import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { formatDate, formatTime, getMatchStatusColor } from "@/lib/utils";
import type { Fixture, Standing, Venue, News, Award, PaginatedResponse, Sponsor, Season, Team } from "@/types";
import { Calendar, Trophy, MapPin, Users, ChevronRight, Star, Medal, Sparkles, Handshake, ArrowUpRight, Flame, Target } from "lucide-react";
import { LeagueHero, LeagueCard, LeagueEmptyState, SectionLink, StatTile, TrendBadge } from "@/components/league/LeagueUI";

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export function HomePage() {
  const navigate = useNavigate();

  const { data: settings } = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => api.get<Record<string, string>>("/settings"),
    retry: false,
  });

  const { data: fixtures } = useQuery({ queryKey: ["featured-fixtures"], queryFn: () => api.get<PaginatedResponse<Fixture>>("/league/fixtures?limit=6") });
  const { data: standings } = useQuery({ queryKey: ["standings"], queryFn: () => api.get<Standing[]>("/league/standings") });
  const { data: venues } = useQuery({ queryKey: ["venues"], queryFn: () => api.get<PaginatedResponse<Venue>>("/bookings/venues?limit=4") });
  const { data: news } = useQuery({ queryKey: ["home-news"], queryFn: () => api.get<PaginatedResponse<News>>("/league/news?limit=4") });
  const { data: awards } = useQuery({ queryKey: ["awards"], queryFn: () => api.get<Award[]>("/league/awards") });
  const { data: teamList } = useQuery({ queryKey: ["home-teams"], queryFn: () => api.get<Team[]>("/league/teams") });
  const { data: sponsors } = useQuery({ queryKey: ["sponsors"], queryFn: () => api.get<{ data: Sponsor[] }>("/league/sponsors") });
  const { data: currentSeason } = useQuery({ queryKey: ["current-season"], queryFn: () => api.get<Season>("/league/seasons/current"), retry: false });

  const heroImage = settings?.site_hero_url || "/hero.jpeg";
  const itemList = fixtures?.data || [];
  const standingsList = standings || [];
  const venueList = venues?.data || [];
  const newsList = news?.data || [];
  const awardList = awards || [];
  const sponsorList = sponsors?.data || [];

  const nextMatch = useMemo(() => itemList.find((f) => f.status === "SCHEDULED" || f.status === "LIVE") || itemList[0], [itemList]);
  const leader = standingsList[0];
  const topScorer = newsList[0];

  return (
    <div className="space-y-10 pb-8">
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <LeagueHero
          image={heroImage}
          eyebrow={<><Sparkles className="h-3.5 w-3.5" /> {currentSeason?.name || "Current season"}</>}
          title={<>The league, the venues, and the moments that matter</>}
          subtitle="Track fixtures, form, standings, club profiles, and matchday stories from one place. Built for quick scanning and quick decisions."
          actions={(
            <>
              <Button size="lg" className="gap-2" onClick={() => navigate("/booking")}><Calendar className="h-5 w-5" /> Book a Turf</Button>
              <Button size="lg" variant="secondary" className="gap-2" onClick={() => navigate("/league")}><Trophy className="h-5 w-5" /> Open League Hub</Button>
            </>
          )}
          stats={[
            { label: "Teams", value: settings?.stat_teams || "0" },
            { label: "Players", value: settings?.stat_players || "0" },
            { label: "Matches", value: settings?.stat_matches || "0" },
            { label: "Venues", value: settings?.stat_venues || "0" },
          ]}
        />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <motion.div variants={fadeUp}><StatTile label="Current season" value={currentSeason?.name || "Season pending"} detail={currentSeason?.isCurrent ? "Live season" : "Season archive"} /></motion.div>
          <motion.div variants={fadeUp}><StatTile label="League leader" value={leader?.team?.name || "No table yet"} detail={leader ? `#${leader.position} • ${leader.points} pts` : "Standings will appear once available"} /></motion.div>
          <motion.div variants={fadeUp}><StatTile label="Next match" value={nextMatch ? `${nextMatch.homeTeam.shortName || nextMatch.homeTeam.name} vs ${nextMatch.awayTeam.shortName || nextMatch.awayTeam.name}` : "No fixtures yet"} detail={nextMatch ? `${formatDate(nextMatch.matchDate)} • ${nextMatch.kickoffTime || "TBD"}` : "The calendar is quiet for now"} /></motion.div>
          <motion.div variants={fadeUp}><StatTile label="Top story" value={topScorer?.title || "News coming soon"} detail={topScorer?.publishedAt ? formatDate(topScorer.publishedAt) : "League coverage updates here"} /></motion.div>
        </motion.div>
      </div>

      {/* Teams */}
      {teamList && teamList.length > 0 && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <LeagueCard title="Clubs" action={<SectionLink onClick={() => navigate("/league")}>All clubs</SectionLink>}>
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {teamList.slice(0, 8).map((team) => (
                <button key={team.id} onClick={() => navigate(`/league/teams/${team.slug}`)} className="flex items-center gap-3 rounded-xl border p-3 text-left transition hover:bg-secondary/60">
                  <img src={team.logoUrl || "/placeholder.svg"} alt="" className="h-12 w-12 rounded-full bg-muted object-cover" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{team.name}</p>
                    <p className="text-xs text-muted-foreground">{team._count?.players || 0} players</p>
                  </div>
                </button>
              ))}
            </div>
          </LeagueCard>
        </div>
      )}

      <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 xl:grid-cols-[1.25fr_0.75fr]">
        <LeagueCard
          title="Matchday focus"
          action={<SectionLink onClick={() => navigate("/league/fixtures")}>All fixtures</SectionLink>}
        >
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {itemList.slice(0, 4).map((fixture) => (
              <Card key={fixture.id} className="overflow-hidden border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-center justify-between">
                    <TrendBadge>{fixture.status}</TrendBadge>
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

        <LeagueCard
          title="Table pulse"
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

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <LeagueCard title="Premium venues" action={<SectionLink onClick={() => navigate("/booking")}>Book now</SectionLink>}>
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              {venueList.slice(0, 4).map((venue) => (
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

          <div className="space-y-6">
            <LeagueCard title="Club spotlight" action={<SectionLink onClick={() => navigate("/league/news")}>News</SectionLink>}>
              <div className="grid gap-4 p-4 sm:grid-cols-[160px_1fr]">
                {topScorer?.imageUrl ? (
                  <img src={topScorer.imageUrl} alt="" className="h-full min-h-[180px] w-full rounded-xl object-cover" />
                ) : (
                  <div className="min-h-[180px] rounded-xl bg-gradient-to-br from-primary/20 to-secondary" />
                )}
                <div className="space-y-3">
                  <Badge variant="secondary" className="rounded-full">Latest story</Badge>
                  <h3 className="text-xl font-semibold">{topScorer?.title || "News and analysis"}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-4">{topScorer?.excerpt || "League stories, transfer updates, and matchday notes appear here."}</p>
                  <Button variant="outline" className="gap-2" onClick={() => navigate("/league/news")}>
                    Browse news <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </LeagueCard>

            <LeagueCard title="Awards watch" action={<SectionLink onClick={() => navigate("/league/awards")}>All awards</SectionLink>}>
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                {awardList.slice(0, 4).map((award) => (
                  <button
                    key={award.id}
                    onClick={() => navigate("/league/awards")}
                    className="flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition hover:bg-secondary/60"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-500/10">
                      <Medal className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{award.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {award.winner 
                          ? (award.type === "TEAM" && award.winnerTeam ? award.winnerTeam.name : `${award.winner.firstName} ${award.winner.lastName}`)
                          : award.type === "TEAM" ? "Team Award"
                          : award.votingEnabled ? "Voting in progress"
                          : "TBD"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </LeagueCard>
          </div>
        </div>
      </div>

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

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <LeagueCard title="Latest news" action={<SectionLink onClick={() => navigate("/league/news")}>All news</SectionLink>}>
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
            {newsList.slice(0, 4).map((article) => (
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
