import { AppError } from "../../middleware/errorHandler.js";
import { isValidDateOnly, localNow } from "../../utils/time.js";

export type CalendarRequest = {
  venueId: string;
  startDate?: string;
  endDate?: string;
  view: "day" | "week" | "month";
  audience: "staff" | "public";
};

export function calendarRange(request: Pick<CalendarRequest, "startDate" | "endDate" | "view">, timezone: string, now = new Date()) {
  if ((request.startDate && !isValidDateOnly(request.startDate)) || (request.endDate && !isValidDateOnly(request.endDate))) throw new AppError("Use valid YYYY-MM-DD calendar dates", 400);
  const today = localNow(timezone, now).date;
  let startDate = request.startDate || today;
  if (request.view === "month" && !request.startDate) startDate = `${today.slice(0, 7)}-01`;
  let endDate = request.endDate;
  if (!endDate) {
    if (request.view === "month") {
      const [year, month] = startDate.split("-").map(Number);
      endDate = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    } else {
      endDate = new Date(Date.parse(`${startDate}T00:00:00Z`) + (request.view === "week" ? 6 : 0) * 86400_000).toISOString().slice(0, 10);
    }
  }
  const days = (Date.parse(endDate) - Date.parse(startDate)) / 86400_000 + 1;
  if (!isValidDateOnly(startDate) || !isValidDateOnly(endDate) || days < 1 || days > 31) throw new AppError("Choose a valid calendar range of 1–31 days", 400);
  return { startDate, endDate };
}
