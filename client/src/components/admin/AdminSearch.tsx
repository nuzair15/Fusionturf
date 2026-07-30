import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Search, Command, ArrowUpDown, ExternalLink, X } from "lucide-react";
import { api } from "@/lib/api";

interface SearchResult {
  id: string;
  label: string;
  description: string;
  type: string;
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

  const { data, isFetching } = useQuery({
    queryKey: ["admin-search", debouncedQuery],
    queryFn: () => api.get<{ data: SearchResult[] }>("/admin/search", { q: debouncedQuery }),
    enabled: debouncedQuery.length > 0,
    staleTime: 30000,
  });

  const results = data?.data || [];
  const limited = results.slice(0, 12);

  const handleSelect = useCallback((result: SearchResult) => {
    const tabMap: Record<string, string> = {
      team: "teams", player: "players", venue: "venues",
      booking: "bookings", fixture: "fixtures", news: "news",
      sponsor: "sponsors", user: "users",
    };
    navigate(`/admin?tab=${tabMap[result.type] || result.type}`);
    onClose();
  }, [navigate, onClose]);

  useEffect(() => { setSelectedIdx(0); }, [debouncedQuery]);

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

  useEffect(() => { inputRef.current?.focus(); }, []);

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
          {isFetching && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent"
            />
          )}
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
          ) : limited.length === 0 && !isFetching ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Search className="mb-2 h-8 w-8" />
              <p className="text-sm">No results for "{query}"</p>
            </div>
          ) : limited.length === 0 && isFetching ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent"
              />
              <p className="mt-3 text-sm">Searching...</p>
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
