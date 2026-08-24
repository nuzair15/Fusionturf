import { Star } from "lucide-react";
import type { LiveTeam } from "@/types/live";
import { Button } from "@/components/ui/button";
import { LiveDialog } from "./LiveDialog";
import { cn } from "@/lib/utils";

export function ManOfTheMatchDialog({ open, home, away, selectedId, onClose, onSelect }: { open: boolean; home: LiveTeam; away: LiveTeam; selectedId?: string | null; onClose: () => void; onSelect: (playerId: string | null) => Promise<void> | void }) {
  if (!open) return null;
  const teams = [home, away];
  return <LiveDialog open={open} onClose={onClose} title="Man of the Match" footer={<Button variant="outline" className="w-full" onClick={onClose}>Done</Button>}>
    <p className="mb-4 text-sm text-muted-foreground">Choose the player who earned the match award. You can change this at any time.</p>
    <div className="space-y-4">{teams.map((team) => <section key={team.id}><p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{team.name}</p><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{team.players.map((player) => { const selected = player.id === selectedId; return <button key={player.id} onClick={() => void onSelect(selected ? null : player.id)} className={cn("flex items-center gap-3 rounded-xl border p-3 text-left transition", selected ? "border-amber-400 bg-amber-500/10" : "hover:bg-muted/60")}><img src={player.photoUrl || "/placeholder.svg"} alt="" className="h-9 w-9 rounded-full bg-muted object-cover" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{player.firstName} {player.lastName}</span><span className="block text-xs text-muted-foreground">{player.position || "Player"}</span></span><Star className={cn("h-4 w-4", selected ? "fill-amber-400 text-amber-500" : "text-muted-foreground")} /></button>; })}</div></section>)}</div>
  </LiveDialog>;
}
