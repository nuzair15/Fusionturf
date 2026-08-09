import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function SearchPage() {
  const [params] = useSearchParams(); const navigate = useNavigate(); const q = params.get("q") || ""; const [input, setInput] = useState(q);
  const { data, isLoading } = useQuery({ queryKey: ["search", q], queryFn: () => api.get<any>("/league/search", { q }), enabled: q.length >= 2 });
  const groups = [{ key: "teams", title: "Teams", path: (x: any) => `/league/teams/${x.slug}`, label: (x: any) => x.name }, { key: "players", title: "Players", path: (x: any) => `/league/players/${x.slug}`, label: (x: any) => `${x.firstName} ${x.lastName}` }, { key: "fixtures", title: "Fixtures", path: (x: any) => `/league/fixtures/${x.id}`, label: (x: any) => `${x.homeTeam.name} vs ${x.awayTeam.name}` }, { key: "venues", title: "Venues", path: (x: any) => `/booking/${x.slug}`, label: (x: any) => `${x.name} · ${x.city}` }, { key: "news", title: "News", path: () => "/league/news", label: (x: any) => x.title }];
  return <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6"><form onSubmit={(e) => { e.preventDefault(); navigate(`/search?q=${encodeURIComponent(input)}`); }} className="mb-8 flex gap-2"><input autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder="Search teams, players, fixtures, venues, news" className="h-11 flex-1 rounded-md border bg-background px-4" /><Button type="submit">Search</Button></form>{isLoading && <p className="text-muted-foreground">Searching…</p>}{q && !isLoading && <div className="grid gap-4 md:grid-cols-2">{groups.map((group) => data?.[group.key]?.length ? <Card key={group.key}><CardHeader><CardTitle>{group.title}</CardTitle></CardHeader><CardContent className="space-y-2">{data[group.key].map((item: any) => <button key={item.id} onClick={() => navigate(group.path(item))} className="block w-full rounded-lg border p-3 text-left text-sm hover:bg-secondary/50">{group.label(item)}</button>)}</CardContent></Card> : null)}</div>}</div>;
}
