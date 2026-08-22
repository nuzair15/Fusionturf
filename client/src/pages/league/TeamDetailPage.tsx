import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import type { Team } from "@/types";
import { ChevronLeft, MapPin, CalendarDays, Trophy, Users, GalleryVertical, BadgeIcon } from "lucide-react";
import { LeagueHero, LeagueCard, LeaguePills, LeagueEmptyState } from "@/components/league/LeagueUI";
import { formatDate } from "@/lib/utils";
import { FollowButton } from "@/components/league/FollowButton";
import { PageError, PageSkeleton } from "@/components/PageState";
import { fixtureDateKey, sortedFixtures } from "@/lib/fixtures";

export function TeamDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");

  const { data: team, isLoading, isError, refetch } = useQuery({
    queryKey: ["team", slug],
    queryFn: () => api.get<Team>(`/league/teams/${slug}`),
    enabled: !!slug,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });

  const allMatches = useMemo(() => {
    return sortedFixtures([...(team?.homeMatches || []), ...(team?.awayMatches || [])]);
  }, [team]);
  const standing = team?.standings?.[0];

  if (isLoading) return <PageSkeleton />;
  if (isError || !team) return <PageError title="Team profile not found" description="This club may have been removed or its profile is temporarily unavailable." onRetry={() => void refetch()} action={<Button variant="outline" onClick={() => navigate("/league")}>Back to league</Button>} />;

  return (
    <div className="space-y-8 pb-8">
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <Button variant="ghost" onClick={() => { if (window.history.state?.idx > 0) navigate(-1); else navigate("/league"); }} className="mb-4 gap-1">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        <LeagueHero
          image={team.coverUrl || team.logoUrl || "/hero.jpeg"}
          eyebrow={<><BadgeIcon className="h-3.5 w-3.5" /> Club profile</>}
          title={team.name}
          subtitle={`${team.city || "City unknown"} • ${team.homeStadium || "Home venue pending"}${team.description ? ` • ${team.description}` : ""}`}
          actions={(
            <>
              <FollowButton type="TEAM" entityId={team.id} />
              <Badge variant="secondary" className="rounded-full px-3 py-1">{team._count?.players || 0} players</Badge>
              <Badge variant="secondary" className="rounded-full px-3 py-1">{standing ? `#${standing.position} • ${standing.points} pts` : "No standing yet"}</Badge>
            </>
          )}
          stats={[
            { label: "Founded", value: team.foundedYear || "—" },
            { label: "Matches", value: allMatches.length },
            { label: "Sponsors", value: team.sponsors?.length || 0 },
            { label: "Gallery", value: team.galleries?.length || 0 },
          ]}
        />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <LeaguePills
          active={tab}
          onChange={setTab}
          items={[
            { key: "overview", label: "Overview", icon: <Trophy className="h-4 w-4" /> },
            { key: "squad", label: "Squad", icon: <Users className="h-4 w-4" /> },
            { key: "fixtures", label: "Fixtures", icon: <CalendarDays className="h-4 w-4" /> },
            { key: "stats", label: "Stats", icon: <BadgeIcon className="h-4 w-4" /> },
            { key: "gallery", label: "Gallery", icon: <GalleryVertical className="h-4 w-4" /> },
          ]}
        />
      </div>

      {tab === "overview" && (
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[1.15fr_0.85fr]">
          <LeagueCard title="About the club">
            <div className="space-y-4 p-4">
              <p className="text-sm text-muted-foreground">{team.description || "No club description added yet."}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border bg-secondary/30 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Home stadium</p>
                  <p className="mt-1 font-semibold">{team.homeStadium || "TBD"}</p>
                </div>
                <div className="rounded-2xl border bg-secondary/30 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Location</p>
                  <p className="mt-1 font-semibold">{team.city || "TBD"}</p>
                </div>
              </div>
            </div>
          </LeagueCard>

          <LeagueCard title="Season snapshot">
            <div className="space-y-3 p-4">
              {standing ? (
                <>
                  <div className="rounded-2xl border bg-primary/5 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Current position</p>
                    <p className="mt-1 text-3xl font-bold">#{standing.position}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ["Played", standing.played],
                      ["Wins", standing.wins],
                      ["Draws", standing.draws],
                      ["Losses", standing.losses],
                      ["Goals For", standing.goalsFor],
                      ["Goals Against", standing.goalsAgainst],
                    ].map(([label, value]) => (
                      <div key={label as string} className="rounded-2xl border bg-secondary/30 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
                        <p className="mt-1 text-lg font-semibold">{value as number}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl border bg-secondary/30 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Points</p>
                    <p className="mt-1 text-3xl font-bold">{standing.points}</p>
                  </div>
                </>
              ) : (
                <LeagueEmptyState title="No season table yet" description="This club will show its ranking once standings exist." />
              )}
            </div>
          </LeagueCard>
        </div>
      )}

      {tab === "squad" && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <LeagueCard title="Squad">
            {team.players && team.players.length > 0 ? (
              <div className="grid gap-3 p-4 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {team.players.map((player) => {
                  return (
                    <button key={player.id} onClick={() => navigate(`/league/players/${player.slug}`)} className="overflow-hidden rounded-2xl border text-left transition hover:-translate-y-0.5 hover:shadow-md">
                      <div className="aspect-[4/5] bg-muted">
                        <img src={player.photoUrl || "/placeholder.svg"} alt="" className="h-full w-full object-cover" />
                      </div>
                      <div className="space-y-1 p-3">
                        <p className="truncate font-semibold">{player.firstName} {player.lastName}</p>
                        <p className="text-xs text-muted-foreground">{player.position || "Player"} • #{player.jerseyNumber || "—"}</p>
                        <p className="text-xs text-primary">Open profile for statistics →</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-4"><LeagueEmptyState title="No squad uploaded" description="Add players to surface the squad view." /></div>
            )}
          </LeagueCard>
        </div>
      )}

      {tab === "fixtures" && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <LeagueCard title="Fixtures">
            {allMatches.length > 0 ? (
              <div className="space-y-2 p-4">
                {allMatches.slice(0, 8).map((match) => (
                  <button key={match.id} onClick={() => navigate(`/league/fixtures/${match.id}`)} className="flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left transition hover:bg-secondary/50">
                    <div className="flex items-center gap-3">
                      <img src={match.homeTeam.logoUrl || "/placeholder.svg"} alt="" className="h-9 w-9 rounded-full bg-muted object-cover" />
                      <div>
                        <p className="font-semibold">{match.homeTeam.shortName || match.homeTeam.name} vs {match.awayTeam.shortName || match.awayTeam.name}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(fixtureDateKey(match))} · {match.kickoffTime || "TBD"}</p>
                      </div>
                    </div>
                    <Badge variant={match.status === "COMPLETED" ? "default" : "secondary"}>
                      {match.status === "COMPLETED" ? `${match.homeScore ?? 0}-${match.awayScore ?? 0}` : match.status}
                    </Badge>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4"><LeagueEmptyState title="No fixtures yet" description="Fixtures will show here once they’re scheduled." /></div>
            )}
          </LeagueCard>
        </div>
      )}

      {tab === "stats" && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <LeagueCard title="Team stats">
              <div className="p-4 text-sm">
                {standing ? (
                  <div className="space-y-3">
                    <div className="flex justify-between"><span className="text-muted-foreground">Position</span><span className="font-semibold">#{standing.position}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Points</span><span className="font-semibold">{standing.points}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Goal difference</span><span className="font-semibold">{standing.goalDifference >= 0 ? `+${standing.goalDifference}` : standing.goalDifference}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Form</span><span className="font-semibold">{standing.form || "—"}</span></div>
                  </div>
                ) : <LeagueEmptyState title="No stats yet" description="Season data will appear here after the first round." />}
              </div>
            </LeagueCard>

            <LeagueCard title="Performance">
              <div className="grid gap-3 p-4">
                {[
                  ["Wins", standing?.wins || 0],
                  ["Draws", standing?.draws || 0],
                  ["Losses", standing?.losses || 0],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-2xl border bg-secondary/30 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="mt-1 text-2xl font-bold">{value as number}</p>
                  </div>
                ))}
              </div>
            </LeagueCard>

            <LeagueCard title="Roster size">
              <div className="p-4">
                <div className="rounded-2xl border bg-secondary/30 p-4 text-center">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Players</p>
                  <p className="mt-1 text-4xl font-bold">{team._count?.players || 0}</p>
                </div>
              </div>
            </LeagueCard>
          </div>
        </div>
      )}

      {tab === "gallery" && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <LeagueCard title="Gallery">
            {team.galleries && team.galleries.length > 0 ? (
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
                {team.galleries.slice(0, 8).map((gallery) => (
                  <img key={gallery.id} src={gallery.imageUrl} alt="" className="aspect-square rounded-2xl object-cover" />
                ))}
              </div>
            ) : (
              <div className="p-4"><LeagueEmptyState title="No gallery yet" description="Add club media to show matchday and behind-the-scenes moments." /></div>
            )}
          </LeagueCard>
        </div>
      )}
    </div>
  );
}
