import { motion, AnimatePresence } from "framer-motion";
import type { LiveFixtureInfo } from "@/types/live";
import { TeamLogo } from "./TeamLogo";
import { StatusBadge } from "./StatusBadge";

export function Scoreboard({ fixture, homeName, awayName, homeLogo, awayLogo }: {
  fixture: LiveFixtureInfo;
  homeName: string;
  awayName: string;
  homeLogo?: string;
  awayLogo?: string;
}) {
  const homeScore = fixture.homeScore ?? 0;
  const awayScore = fixture.awayScore ?? 0;

  return (
    <div className="flex items-center justify-center gap-3 sm:gap-6">
      <div className="flex w-28 flex-col items-center gap-2 text-center sm:w-36">
        <TeamLogo name={homeName} logoUrl={homeLogo} size="md" />
        <p className="line-clamp-2 text-xs font-semibold leading-tight sm:text-sm">{homeName}</p>
      </div>

      <div className="flex flex-col items-center gap-1">
        <StatusBadge status={fixture.status} />
        <div className="flex items-center gap-2 sm:gap-3">
          <AnimatePresence mode="popLayout">
            <motion.span
              key={`h-${homeScore}`}
              initial={{ scale: 1.6, y: -8, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 18 }}
              className="w-12 text-center text-4xl font-black tabular-nums tracking-tight text-foreground sm:w-16 sm:text-6xl"
            >
              {homeScore}
            </motion.span>
          </AnimatePresence>
          <span className="text-3xl font-bold text-muted-foreground sm:text-5xl">:</span>
          <AnimatePresence mode="popLayout">
            <motion.span
              key={`a-${awayScore}`}
              initial={{ scale: 1.6, y: -8, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 18 }}
              className="w-12 text-center text-4xl font-black tabular-nums tracking-tight text-foreground sm:w-16 sm:text-6xl"
            >
              {awayScore}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>

      <div className="flex w-28 flex-col items-center gap-2 text-center sm:w-36">
        <TeamLogo name={awayName} logoUrl={awayLogo} size="md" />
        <p className="line-clamp-2 text-xs font-semibold leading-tight sm:text-sm">{awayName}</p>
      </div>
    </div>
  );
}
