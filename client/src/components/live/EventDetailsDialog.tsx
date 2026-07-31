import type { TimelineEvent } from "@/types/live";
import { LiveDialog } from "./LiveDialog";
import { eventKindLabel } from "@/lib/liveTimeline";
import { TeamLogo } from "./TeamLogo";

export function EventDetailsDialog({ open, event, teamName, onClose }: {
  open: boolean;
  event: TimelineEvent | null;
  teamName?: string;
  onClose: () => void;
}) {
  if (!event) return null;
  const rows: { label: string; value: string }[] = [
    { label: "Type", value: eventKindLabel[event.kind] },
    { label: "Minute", value: `${event.minute}'` },
  ];
  if (teamName) rows.push({ label: "Team", value: teamName });
  if (event.player) rows.push({ label: "Player", value: `${event.player.firstName} ${event.player.lastName}` });
  if (event.playerOff) rows.push({ label: "Player Off", value: `${event.playerOff.firstName} ${event.playerOff.lastName}` });
  if (event.playerOn) rows.push({ label: "Player On", value: `${event.playerOn.firstName} ${event.playerOn.lastName}` });
  if (event.note) rows.push({ label: "Note", value: event.note });

  return (
    <LiveDialog open={open} onClose={onClose} title="Event Details">
      <div className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-4 rounded-lg bg-muted/40 px-3 py-2">
            <span className="shrink-0 text-xs font-semibold text-muted-foreground">{r.label}</span>
            <span className="text-right text-sm font-medium">{r.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center">
        <TeamLogo name={teamName || "Unknown"} size="sm" />
      </div>
    </LiveDialog>
  );
}
