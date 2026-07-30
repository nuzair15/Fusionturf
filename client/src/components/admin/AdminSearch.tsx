import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Command, ArrowUpDown, ExternalLink, X } from "lucide-react";
import { api } from "@/lib/api";
import type { Team, Player, Venue, Booking, Fixture, News, Sponsor, User } from "@/types";

interface SearchResult {
  id: string;
  label: string;
  description: string;
  url: string;
  type: string;
}

function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return false;
  let qi = 0;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function AdminSearch({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const debouncedQuery = useDebounce(query, 200);

  const { data: teams } = useQuery({ queryKey: ["admin-teams"], queryFn: () => api.get<Team[]>("/admin/teams"), enabled: debouncedQuery.length > 0 });
  const { data: players } = useQuery({ queryKey: ["admin-players-search"], queryFn: () => api.get<{ data: Player[] }>("/admin/players", { limit: "50" }), enabled: debouncedQuery.length > 0 });
  const { data: venues } = useQuery({ queryKey: ["admin-venues"], queryFn: () => api.get<{ data: Venue[] }>("/admin/venues"), enabled: debouncedQuery.length > 0 });
  const { data: bookings } = useQuery({ queryKey: ["admin-bookings-search"], queryFn: () => api.get<{ data: Booking[] }>("/admin/bookings", { limit: "30" }), enabled: debouncedQuery.length > 0 });
  const { data: fixtures } = useQuery({ queryKey: ["admin-fixtures-search"], queryFn: () => api.get<{ data: Fixture[] }>("/admin/fixtures", { limit: "30" }), enabled: debouncedQuery.length > 0 });
  const { data: news } = useQuery({ queryKey: ["admin-news-search"], queryFn: () => api.get<{ data: News[] }>("/admin/news", { limit: "30" }), enabled: debouncedQuery.length > 0 });
  const { data: sponsors } = useQuery({ queryKey: ["admin-sponsors"], queryFn: () => api.get<{ data: Sponsor[] }>("/admin/sponsors"), enabled: debouncedQuery.length > 0 });
  const { data: users } = useQuery({ queryKey: ["admin-users-search"], queryFn: () => api.get<{ data: User[] }>("/admin/users", { limit: "30" }), enabled: debouncedQuery.length > 0 });

  const results: SearchResult[] = [];

  if (debouncedQuery.length > 0) {
    const q = debouncedQuery;
    (teams || []).forEach((t) => {
      if (fuzzyMatch(t.name, q)) results.push({ id: t.id, label: t.name, description: "Team", url: `/admin?tab=teams`, type: "team" });
    });
    (players?.data || []).forEach((p) => {
      const name = `${p.firstName} ${p.lastName}`;
      if (fuzzyMatch(name, q)) results.push({ id: p.id, label: name, description: `Player — ${p.team?.name || "No team"}`, url: `/admin?tab=players`, type: "player" });
    });
    (venues?.data || []).forEach((v) => {
      if (fuzzyMatch(v.name, q)) results.push({ id: v.id, label: v.name, description: "Venue", url: `/admin?tab=venues`, type: "venue" });
    });
    (bookings?.data || []).forEach((b) => {
      const name = b.user ? `${b.user.firstName} ${b.user.lastName}` : b.bookingNumber;
      if (fuzzyMatch(name, q)) results.push({ id: b.id, label: `#${b.bookingNumber}`, description: `${b.turf?.venue?.name || "Venue"} — ${b.user?.firstName || ""} ${b.user?.lastName || ""}`, url: `/admin?tab=bookings`, type: "booking" });
    });
    (fixtures?.data || []).forEach((f) => {
      const label = `${f.homeTeam?.shortName || "?"} vs ${f.awayTeam?.shortName || "?"}`;
      if (fuzzyMatch(label, q)) results.push({ id: f.id, label, description: `Fixture — ${f.status}`, url: `/admin?tab=fixtures`, type: "fixture" });
    });
    (news?.data || []).forEach((n) => {
      if (fuzzyMatch(n.title, q)) results.push({ id: n.id, label: n.title, description: "News", url: `/admin?tab=news`, type: "news" });
    });
    (sponsors?.data || []).forEach((s) => {
      if (fuzzyMatch(s.name, q)) results.push({ id: s.id, label: s.name, description: "Sponsor", url: `/admin?tab=sponsors`, type: "sponsor" });
    });
    (users?.data || []).forEach((u) => {
      const name = `${u.firstName} ${u.lastName}`;
      if (fuzzyMatch(name, q)) results.push({ id: u.id, label: name, description: `User — ${u.email}`, url: `/admin?tab=users`, type: "user" });
    });
  }

  const limited = results.slice(0, 12);

  const handleSelect = useCallback((result: SearchResult) => {
    navigate(result.url);
    onClose();
  }, [navigate, onClose]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [debouncedQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, limited.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
      if (e.key === "Enter" && limited[selectedIdx]) { handleSelect(limited[selectedIdx]); }
      if (e.key === "Escape") { onClose(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [limited, selectedIdx, handleSelect, onClose]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm pt-[15vh]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -10 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-xl rounded-xl border bg-card shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search teams, players, bookings, venues..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden shrink-0 items-center gap-1 rounded border px-1.5 text-[11px] text-muted-foreground sm:flex">
            <Command className="h-3 w-3" />K
          </kbd>
          <button onClick={onClose} className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {query.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Search className="mb-2 h-8 w-8" />
              <p className="text-sm">Type to search across everything</p>
              <div className="mt-4 flex gap-3 text-xs text-muted-foreground/60">
                <span className="flex items-center gap-1"><ArrowUpDown className="h-3 w-3" /> Navigate</span>
                <span className="flex items-center gap-1"><kbd className="rounded border px-1">⏎</kbd> Open</span>
                <span className="flex items-center gap-1"><kbd className="rounded border px-1">ESC</kbd> Close</span>
              </div>
            </div>
          ) : limited.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Search className="mb-2 h-8 w-8" />
              <p className="text-sm">No results for "{query}"</p>
            </div>
          ) : (
            <div className="py-2">
              {limited.map((result, idx) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleSelect(result)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                    idx === selectedIdx ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                  }`}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block truncate font-medium">{result.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{result.description}</span>
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t px-4 py-2 text-[11px] text-muted-foreground/50">
          {limited.length > 0 ? `${limited.length} result${limited.length > 1 ? "s" : ""}` : "Search across teams, players, bookings, venues, users, sponsors, fixtures & news"}
        </div>
      </motion.div>
    </motion.div>
  );
}
