import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import type { Season } from "@/types";

export function useSeasonSelection() {
  const [params, setParams] = useSearchParams();
  const seasonId = params.get("seasonId") || "";
  const setSeasonId = (id: string) => setParams(previous => { const next = new URLSearchParams(previous); if (id) next.set("seasonId", id); else next.delete("seasonId"); return next; });
  const seasonParams: Record<string, string> = seasonId ? { seasonId } : {};
  return { seasonId, setSeasonId, seasonParams };
}

export function SeasonPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { data: seasons, isError } = useQuery({ queryKey: ["public-seasons"], queryFn: () => api.get<Season[]>("/league/seasons") });
  return <label className="my-4 flex flex-wrap items-center gap-2 text-sm">Season<select aria-label="Season" className="rounded-lg border bg-background px-3 py-2 text-foreground" value={value} onChange={e => onChange(e.target.value)}><option value="">Current season</option>{seasons?.map(s => <option key={s.id} value={s.id}>{s.name}{s.isCurrent ? " (current)" : ""}</option>)}</select>{isError && <span>Season list unavailable</span>}</label>;
}
