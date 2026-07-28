import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { formatCurrency, formatTime } from "@/lib/utils";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export function VenueCalendar({ venueId, venues, onClose }: { venueId: string; venues: { id: string; name: string }[]; onClose: () => void }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedVenue, setSelectedVenue] = useState(venueId);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["venue-calendar", selectedVenue, month, year],
    queryFn: () => api.get<{ data: Record<string, any[]>; total: number }>(`/bookings/calendar?venueId=${selectedVenue}&month=${month}&year=${year}`),
    enabled: !!selectedVenue,
  });

  const bookingsByDate = data?.data || {};

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();

  const calendarDays = useMemo(() => {
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [firstDay, daysInMonth]);

  const prev = () => { if (month === 1) { setMonth(12); setYear((y) => y - 1); } else setMonth((m) => m - 1); setSelectedDate(null); };
  const next = () => { if (month === 12) { setMonth(1); setYear((y) => y + 1); } else setMonth((m) => m + 1); setSelectedDate(null); };

  const dateKey = (d: number) => `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2"><CalendarDays className="h-5 w-5" /> Booking Calendar</h3>
        <Select value={selectedVenue} onChange={(e) => setSelectedVenue(e.target.value)} className="w-56">
          {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={prev}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="font-semibold">{MONTHS[month - 1]} {year}</span>
        <Button variant="ghost" size="sm" onClick={next}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      <div className="grid grid-cols-7 gap-px rounded-lg border bg-muted">
        {DAYS.map((d) => <div key={d} className="bg-background p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>)}
        {calendarDays.map((d, i) => {
          if (d === null) return <div key={`e-${i}`} className="bg-background p-2" />;
          const key = dateKey(d);
          const dayBookings = bookingsByDate[key];
          const count = dayBookings?.length || 0;
          const isToday = key === new Date().toISOString().split("T")[0];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedDate(selectedDate === key ? null : key)}
              className={`bg-background p-2 text-left text-sm transition hover:bg-accent ${isToday ? "ring-1 ring-primary" : ""} ${selectedDate === key ? "bg-primary/10" : ""}`}
            >
              <span className={`font-medium ${isToday ? "text-primary" : ""}`}>{d}</span>
              {count > 0 && <div className="mt-1"><Badge variant={count > 2 ? "default" : "secondary"} className="text-[10px] px-1">{count} booking{count > 1 ? "s" : ""}</Badge></div>}
            </button>
          );
        })}
      </div>

      {selectedDate && (bookingsByDate[selectedDate]?.length > 0) && (
        <Card>
          <CardHeader><CardTitle className="text-base">Bookings for {selectedDate}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {bookingsByDate[selectedDate].map((b: any) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <div>
                  <p className="font-medium">{b.customerName}</p>
                  <p className="text-xs text-muted-foreground">{b.customerPhone}</p>
                  <p className="text-xs text-muted-foreground">{b.turf?.name}</p>
                </div>
                <div className="text-right">
                  <p>{formatTime(b.startTime)} - {formatTime(b.endTime)}</p>
                  <Badge variant={b.status === "CONFIRMED" ? "default" : b.status === "CANCELLED" ? "destructive" : "secondary"}>{b.status}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isLoading && <div className="h-32 animate-pulse rounded-lg bg-muted" />}
    </div>
  );
}
