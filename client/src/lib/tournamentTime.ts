function wallParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(instant);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

export function tournamentDateTimeInput(iso: string, timeZone: string) {
  const p = wallParts(new Date(iso), timeZone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function tournamentDateTimeIso(local: string, timeZone: string) {
  const [date, time] = local.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let instant = desired;
  for (let i = 0; i < 3; i++) {
    const p = wallParts(new Date(instant), timeZone);
    const actual = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
    instant -= actual - desired;
  }
  return new Date(instant).toISOString();
}

export function isTournamentOngoing(tournament: { status: string; startDate: string | null; endDate: string | null; timezone: string }, now = new Date()) {
  if (tournament.status === "LIVE") return true;
  if (tournament.status !== "PUBLISHED" || !tournament.startDate) return false;
  const today = tournamentDateTimeInput(now.toISOString(), tournament.timezone).slice(0, 10);
  return tournament.startDate.slice(0, 10) <= today && (!tournament.endDate || tournament.endDate.slice(0, 10) >= today);
}
