import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { Fixture, PaginatedResponse, Season } from "@/types";
import { ChevronLeft, ChevronRight, CalendarDays, Clock3, Flame, Trophy } from "lucide-react";
import { formatDate, formatTime, getMatchStatusColor } from "@/lib/utils";
import { LeagueHero, LeagueCard, LeagueEmptyState, LeaguePills, TrendBadge } from "@/components/league/LeagueUI";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function FixturesPage() {
  const navigate = useNavigate();
  const today = new Date();
  const [view, setView] = useState("list");
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [teamFilter, setTeamFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [roundFilter, setRoundFilter] = useState("");

  const { data: currentSeason } = useQuery({ queryKey: ["current-season"], queryFn: () => api.get<Season>("/league/seasons/current"), retry: false });
  const { data: teams } = useQuery({ queryKey: ["fixture-teams"], queryFn: () => api.get<any[]>("/league/teams") });
  const { data } = useQuery({ queryKey: ["fixtures-calendar", teamFilter, statusFilter, roundFilter], queryFn: () => api.get<PaginatedResponse<Fixture>>("/league/fixtures", { limit: "120", ...(teamFilter ? { teamId: teamFilter } : {}), ...(statusFilter ? { status: statusFilter } : {}), ...(roundFilter ? { round: roundFilter } : {}) }) });

  const fixtures = data?.data || [];
  const todayKey = today.toISOString().split("T")[0];

  const fixturesByDate = useMemo(() => {
    const map: Record<string, Fixture[]> = {};
    fixtures.forEach((fixture) => {
      const dateKey = fixture.matchDate.split("T")[0];
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(fixture);
    });
    return map;
  }, [fixtures]);

  const groupedFixtures = useMemo(() => {
    const keys = Object.keys(fixturesByDate).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    return keys.map((key) => ({ date: key, fixtures: fixturesByDate[key] }));
  }, [fixturesByDate]);

  const liveFixtures = useMemo(() => fixtures.filter((f) => f.status === "LIVE"), [fixtures]);
  const upcomingFixtures = useMemo(() => fixtures.filter((f) => f.status === "SCHEDULED"), [fixtures]);
  const completedFixtures = useMemo(() => fixtures.filter((f) => f.status === "COMPLETED"), [fixtures]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();

  const calendarDays: Array<{ day: number; dateStr: string; fixtures: Fixture[] } | null> = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    calendarDays.push({ day: d, dateStr, fixtures: fixturesByDate[dateStr] || [] });
  }

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  return (
    <div className="space-y-8 pb-8">
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <LeagueHero
          eyebrow={<><Flame className="h-3.5 w-3.5" /> Fixtures</>}
          title="Match calendar and results"
          subtitle={currentSeason?.name || "Browse live, upcoming, and completed fixtures across the league."}
          stats={[
            { label: "Live", value: liveFixtures.length },
            { label: "Upcoming", value: upcomingFixtures.length },
            { label: "Completed", value: completedFixtures.length },
            { label: "Month", value: MONTHS[viewMonth] },
          ]}
        />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-4 grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-3">
          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="">All teams</option>{(teams || []).map((team: any) => <option key={team.id} value={team.id}>{team.name}</option>)}</select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="">All statuses</option><option value="LIVE">Live</option><option value="SCHEDULED">Upcoming</option><option value="COMPLETED">Completed</option></select>
          <input value={roundFilter} onChange={(e) => setRoundFilter(e.target.value.replace(/\D/g, ""))} placeholder="Filter by round" inputMode="numeric" className="h-10 rounded-md border bg-background px-3 text-sm" />
        </div>
        <LeaguePills
          active={view}
          onChange={setView}
          items={[
            { key: "list", label: "List view", icon: <CalendarDays className="h-4 w-4" /> },
            { key: "calendar", label: "Calendar", icon: <Clock3 className="h-4 w-4" /> },
          ]}
        />
      </div>

      {view === "calendar" && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <LeagueCard
            title={`${MONTHS[viewMonth]} ${viewYear}`}
            action={(
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="h-5 w-5" /></Button>
                <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="h-5 w-5" /></Button>
              </div>
            )}
          >
            <div className="border-b bg-secondary/40 px-4 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Sun Mon Tue Wed Thu Fri Sat
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((cell, index) => (
                <div key={index} className="min-h-[95px] border-b border-r p-2 last:border-r-0">
                  {cell && (
                    <>
                      <div className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                        cell.dateStr === todayKey ? "bg-primary text-primary-foreground" : "bg-secondary/60"
                      }`}>
                        {cell.day}
                      </div>
                      <div className="mt-2 space-y-1">
                        {cell.fixtures.slice(0, 2).map((fixture) => (
                          <button
                            key={fixture.id}
                            onClick={() => navigate(`/league/fixtures/${fixture.id}`)}
                            className="block w-full rounded-lg bg-primary/10 px-2 py-1 text-left text-[10px] font-medium text-primary transition hover:bg-primary/20"
                          >
                            {fixture.homeTeam.shortName || fixture.homeTeam.name} vs {fixture.awayTeam.shortName || fixture.awayTeam.name}
                          </button>
                        ))}
                        {cell.fixtures.length > 2 && <p className="text-[10px] text-muted-foreground">+{cell.fixtures.length - 2} more</p>}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </LeagueCard>
        </div>
      )}

      {view === "list" && (
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 xl:grid-cols-[0.95fr_1.05fr]">
          <LeagueCard title="Matchday blocks" action={<Badge variant="secondary" className="rounded-full">{fixtures.length} fixtures</Badge>}>
            <div className="space-y-4 p-4">
              {groupedFixtures.length > 0 ? groupedFixtures.map((group) => (
                <div key={group.date} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{formatDate(group.date)}</p>
                  <div className="space-y-2">
                    {group.fixtures.map((fixture) => (
                      <button
                        key={fixture.id}
                        onClick={() => navigate(`/league/fixtures/${fixture.id}`)}
                        className="grid gap-3 rounded-2xl border px-4 py-4 text-left transition hover:bg-secondary/50 sm:grid-cols-[1fr_auto_1fr] sm:items-center"
                      >
                        <div className="flex items-center gap-3">
                          <img src={fixture.homeTeam.logoUrl || "/placeholder.svg"} alt="" className="h-10 w-10 rounded-full bg-muted object-cover" />
                          <div>
                            <p className="font-semibold">{fixture.homeTeam.shortName || fixture.homeTeam.name}</p>
                            <p className="text-xs text-muted-foreground">{fixture.homeTeam.city || "Home"}</p>
                          </div>
                        </div>
                        <div className="text-center">
                          <TrendBadge>{fixture.status}</TrendBadge>
                          <p className="mt-2 text-xl font-bold tabular-nums">
                            {fixture.status === "COMPLETED" ? `${fixture.homeScore ?? 0}-${fixture.awayScore ?? 0}` : fixture.status === "LIVE" ? "LIVE" : "VS"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">{fixture.kickoffTime ? formatTime(fixture.kickoffTime) : "TBD"}</p>
                        </div>
                        <div className="flex items-center justify-end gap-3">
                          <div className="text-right">
                            <p className="font-semibold">{fixture.awayTeam.shortName || fixture.awayTeam.name}</p>
                            <p className="text-xs text-muted-foreground">{fixture.stadium || fixture.venue?.name || "Venue TBD"}</p>
                          </div>
                          <img src={fixture.awayTeam.logoUrl || "/placeholder.svg"} alt="" className="h-10 w-10 rounded-full bg-muted object-cover" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )) : (
                <LeagueEmptyState title="No fixtures yet" description="Fixture blocks will appear here once matches are scheduled." />
              )}
            </div>
          </LeagueCard>

          <div className="space-y-6">
            <LeagueCard title="Live now">
              <div className="p-4">
                {liveFixtures.length > 0 ? (
                  <div className="space-y-3">
                    {liveFixtures.map((fixture) => (
                      <button key={fixture.id} onClick={() => navigate(`/league/fixtures/${fixture.id}`)} className="w-full rounded-2xl border border-rose-500/30 bg-rose-500/5 px-4 py-4 text-left transition hover:bg-rose-500/10">
                        <div className="flex items-center justify-between">
                          <TrendBadge><span className={`inline-block h-2 w-2 rounded-full ${getMatchStatusColor("LIVE")}`} /> Live</TrendBadge>
                          <span className="text-xs text-muted-foreground">{fixture.stadium || fixture.venue?.name || "Live venue"}</span>
                        </div>
                        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                          <p className="truncate font-semibold">{fixture.homeTeam.shortName || fixture.homeTeam.name}</p>
                          <p className="text-2xl font-bold tabular-nums text-rose-600">{fixture.homeScore ?? 0}-{fixture.awayScore ?? 0}</p>
                          <p className="truncate text-right font-semibold">{fixture.awayTeam.shortName || fixture.awayTeam.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <LeagueEmptyState title="No live matches" description="When a match goes live, it will jump here automatically." />
                )}
              </div>
            </LeagueCard>

            <LeagueCard title="Quick stats">
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                {[
                  ["Upcoming", upcomingFixtures.length],
                  ["Completed", completedFixtures.length],
                  ["This month", fixtures.filter((f) => f.matchDate.startsWith(`${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`)).length],
                  ["Today", fixtures.filter((f) => f.matchDate.startsWith(todayKey)).length],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-2xl border bg-secondary/30 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="mt-1 text-2xl font-bold">{value as number}</p>
                  </div>
                ))}
              </div>
            </LeagueCard>
          </div>
        </div>
      )}
    </div>
  );
}
