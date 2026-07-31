import type { MatchStatus } from "@/types";
import { cn } from "@/lib/utils";

export const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "NOT STARTED",
  LIVE: "LIVE",
  PAUSED: "PAUSED",
  HALF_TIME: "HALF TIME",
  EXTRA_TIME: "EXTRA TIME",
  PENALTIES: "PENALTIES",
  COMPLETED: "FULL TIME",
  POSTPONED: "POSTPONED",
  CANCELLED: "CANCELLED",
};

export function getStatusTone(status: MatchStatus) {
  switch (status) {
    case "LIVE":
      return { label: "LIVE", className: "bg-emerald-500 text-white animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.6)]" };
    case "PAUSED":
      return { label: "PAUSED", className: "bg-amber-500 text-white" };
    case "HALF_TIME":
      return { label: "HALF TIME", className: "bg-orange-500 text-white" };
    case "EXTRA_TIME":
      return { label: "EXTRA TIME", className: "bg-orange-500 text-white" };
    case "PENALTIES":
      return { label: "PENALTIES", className: "bg-orange-500 text-white" };
    case "COMPLETED":
      return { label: "FULL TIME", className: "bg-red-500 text-white" };
    default:
      return { label: "NOT STARTED", className: "bg-gray-400 text-white" };
  }
}

export function StatusBadge({ status, className }: { status: MatchStatus; className?: string }) {
  const tone = getStatusTone(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-widest uppercase",
        tone.className,
        className
      )}
    >
      {status === "LIVE" && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      {tone.label}
    </span>
  );
}
