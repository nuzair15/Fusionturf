import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { Fixture, PaginatedResponse } from "@/types";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { useState, useMemo } from "react";
import { formatDate } from "@/lib/utils";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function FixturesPage() {
  const navigate = useNavigate();
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  const { data } = useQuery({
    queryKey: ["fixtures-calendar"],
    queryFn: () => api.get<PaginatedResponse<Fixture>>("/league/fixtures", { limit: "100" }),
  });

  const fixtures = data?.data || [];

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();

  const fixturesByDate = useMemo(() => {
    const map: Record<string, Fixture[]> = {};
    fixtures.forEach((f) => {
      const d = f.matchDate.split("T")[0];
      if (!map[d]) map[d] = [];
      map[d].push(f);
    });
    return map;
  }, [fixtures]);

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); } else setViewMonth(viewMonth - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); } else setViewMonth(viewMonth + 1); };

  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    calendarDays.push({ day: d, dateStr, fixtures: fixturesByDate[dateStr] || [] });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Button variant="ghost" onClick={() => navigate("/league")} className="mb-4 gap-1">
          <ChevronLeft className="h-4 w-4" /> Back to League
        </Button>
        <h1 className="mb-2 text-3xl font-bold">Fixtures Calendar</h1>
        <p className="mb-8 text-muted-foreground">Browse upcoming and past matches</p>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b bg-muted/30 p-4">
            <Button variant="ghost" size="sm" onClick={prevMonth}><ChevronLeft className="h-5 w-5" /></Button>
            <h2 className="text-lg font-bold">{MONTHS[viewMonth]} {viewYear}</h2>
            <Button variant="ghost" size="sm" onClick={nextMonth}><ChevronRight className="h-5 w-5" /></Button>
          </div>

          <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground border-b">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-2">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {calendarDays.map((cell, i) => (
              <div key={i} className="min-h-[60px] border-b border-r p-0.5 text-[10px] last:border-r-0 sm:min-h-[80px] sm:p-1 sm:text-sm">
                {cell && (
                  <>
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] sm:h-6 sm:w-6 sm:text-xs ${
                      cell.day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()
                        ? "bg-primary text-primary-foreground" : ""
                    }`}>
                      {cell.day}
                    </span>
                    <div className="mt-0.5 space-y-0.5 sm:mt-1">
                      {cell.fixtures.slice(0, viewMonth === today.getMonth() && viewYear === today.getFullYear() ? 1 : 2).map((f) => (
                        <div
                          key={f.id}
                          className="cursor-pointer rounded bg-primary/10 px-0.5 py-0.5 text-[8px] leading-tight text-primary hover:bg-primary/20 sm:px-1 sm:text-[10px]"
                          onClick={() => navigate(`/league/fixtures/${f.id}`)}
                        >
                          {f.homeTeam.shortName || f.homeTeam.name?.substring(0, 3)} vs {f.awayTeam.shortName || f.awayTeam.name?.substring(0, 3)}
                        </div>
                      ))}
                      {cell.fixtures.length > (viewMonth === today.getMonth() && viewYear === today.getFullYear() ? 1 : 2) && (
                        <span className="text-[8px] text-muted-foreground sm:text-[10px]">+{cell.fixtures.length - (viewMonth === today.getMonth() && viewYear === today.getFullYear() ? 1 : 2)} more</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </Card>

        {fixtures.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-4 text-lg font-bold">All Fixtures</h2>
            <div className="space-y-2">
              {fixtures.map((f) => (
                <div key={f.id} className="flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/20 sm:px-3" onClick={() => navigate(`/league/fixtures/${f.id}`)}>
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <img src={f.homeTeam.logoUrl || "/placeholder.svg"} alt="" className="h-6 w-6 shrink-0 rounded-full bg-muted sm:h-8 sm:w-8" />
                    <span className="truncate text-xs font-medium sm:text-sm">{f.homeTeam.shortName || f.homeTeam.name}</span>
                  </div>
                  <div className="mx-2 shrink-0 text-center sm:mx-3">
                    <div className="text-xs text-muted-foreground">{formatDate(f.matchDate)}</div>
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary sm:px-2 sm:text-xs">
                      {f.status === "COMPLETED" ? `${f.homeScore ?? 0} - ${f.awayScore ?? 0}` : f.status === "SCHEDULED" ? "vs" : f.status}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                    <span className="truncate text-xs font-medium sm:text-sm">{f.awayTeam.shortName || f.awayTeam.name}</span>
                    <img src={f.awayTeam.logoUrl || "/placeholder.svg"} alt="" className="h-6 w-6 shrink-0 rounded-full bg-muted sm:h-8 sm:w-8" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
