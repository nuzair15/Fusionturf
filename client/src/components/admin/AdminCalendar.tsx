import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";
import { ErrorState } from "@/components/admin/ErrorState";
import { formatDate, formatTime, formatCurrency } from "@/lib/utils";
import { businessDateKey } from "@/lib/fixtures";
import type { Booking, Venue } from "@/types";
import {
  ChevronLeft, ChevronRight, CalendarDays, Clock,
  X, Phone, MapPin, DollarSign, User, Calendar,
} from "lucide-react";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);
const WEEKDAY_LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300",
  CONFIRMED: "bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300",
  COMPLETED: "bg-green-100 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300",
  CANCELLED: "bg-red-100 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300",
  RESCHEDULED: "bg-purple-100 border-purple-300 text-purple-800 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-300",
};

type ViewMode = "month" | "week" | "day";

export function AdminCalendar({ venues }: { venues: Venue[] }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedVenue, setSelectedVenue] = useState(venues[0]?.id || "");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [hoveredBooking, setHoveredBooking] = useState<Booking | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const [dragBooking, setDragBooking] = useState<Booking | null>(null);
  const [dropTarget, setDropTarget] = useState<{ date: string; hour: number } | null>(null);
  const [calendarError, setCalendarError] = useState("");

  useEffect(() => { setSelectedVenue((prev) => prev || venues[0]?.id || ""); }, [venues]);

  const { data: calendarData, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-calendar", selectedVenue, month, year],
    queryFn: () => api.get<{ data: Record<string, Booking[]>; total: number }>("/bookings/calendar", { venueId: selectedVenue, month, year }),
    enabled: !!selectedVenue,
    retry: 2,
  });

  const bookingsByDate = calendarData?.data || {};

  const allBookings = useMemo(() => {
    const flat: Booking[] = [];
    for (const date of Object.keys(bookingsByDate)) {
      for (const b of bookingsByDate[date]) flat.push(b);
    }
    return flat;
  }, [bookingsByDate]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const dateKey = (d: number) => `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const todayStr = businessDateKey();
  const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  const calendarDays = useMemo(() => {
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [firstDay, daysInMonth]);

  const prev = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
    setSelectedDate(null);
    setWeekOffset(0);
  };

  const next = () => {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
    setSelectedDate(null);
    setWeekOffset(0);
  };

  const weekDays = useMemo(() => {
    const startOfMonth = new Date(year, month - 1, 1);
    const startDay = startOfMonth.getDay();
    const startDate = new Date(year, month - 1, 1 - startDay + weekOffset * 7);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i));
    }
    return days;
  }, [year, month, weekOffset]);

  const dayBookingsForDate = useCallback((date: string): Booking[] => {
    return bookingsByDate[date] || [];
  }, [bookingsByDate]);

  const bookingTimeToPercent = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return ((h + m / 60 - 6) / 18) * 100;
  };

  const checkConflict = (booking: Booking): boolean => {
    return allBookings.some((b) => {
      if (b.id === booking.id) return false;
      if (b.date !== booking.date) return false;
      if (b.turfId !== booking.turfId) return false;
      return b.startTime < booking.endTime && b.endTime > booking.startTime;
    });
  };

  const handleDayClick = (day: number) => {
    const key = dateKey(day);
    setSelectedDate(selectedDate === key ? null : key);
    setViewMode("day");
  };

  const handleBookingClick = (booking: Booking) => {
    setSelectedBooking(booking);
  };

  const handleMouseEnter = (booking: Booking, e: React.MouseEvent) => {
    setHoveredBooking(booking);
    setHoverPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseLeave = () => {
    setHoveredBooking(null);
  };

  const goToday = () => {
    const [todayYear, todayMonth] = businessDateKey().split("-").map(Number);
    setYear(todayYear);
    setMonth(todayMonth);
    setSelectedDate(null);
    setWeekOffset(0);
  };

  const handleDragStart = (e: any, booking: Booking) => {
    setDragBooking(booking);
    e.dataTransfer!.effectAllowed = "move";
    e.dataTransfer!.setData("text/plain", booking.id);
  };

  const handleDragOver = (e: React.DragEvent, date: string, hour: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget({ date, hour });
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = async (e: React.DragEvent, date: string, hour: number) => {
    e.preventDefault();
    if (!dragBooking) return;
    if (dragBooking.date === date && dragBooking.startTime === `${String(hour).padStart(2, "0")}:00`) {
      setDragBooking(null);
      setDropTarget(null);
      return;
    }
    const duration = dragBooking.duration || 60;
    const endTotalMinutes = hour * 60 + duration;
    if (endTotalMinutes > 24 * 60) {
      setCalendarError("This booking would end after midnight. Choose an earlier slot.");
      setDragBooking(null);
      setDropTarget(null);
      return;
    }
    const endH = Math.floor(endTotalMinutes / 60);
    const endM = endTotalMinutes % 60;
    const newStart = `${String(hour).padStart(2, "0")}:00`;
    const newEnd = `${String(endH).padStart(2, "0")}:${String(Math.round(endM)).padStart(2, "0")}`;
    try {
      setCalendarError("");
      await api.patch(`/admin/bookings/${dragBooking.id}`, { date, startTime: newStart, endTime: newEnd });
      queryClient.invalidateQueries({ queryKey: ["admin-calendar"] });
    } catch (error: any) {
      setCalendarError(error.message || "The booking could not be rescheduled.");
    }
    setDragBooking(null);
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    setDragBooking(null);
    setDropTarget(null);
  };

  const startOfWeek = weekDays[0];

  const weekDayDateKeys = useMemo(() =>
    weekDays.map(localDateKey),
    [weekDays]
  );

  const navigatePrevious = () => viewMode === "week" ? setWeekOffset((value) => value - 1) : prev();
  const navigateNext = () => viewMode === "week" ? setWeekOffset((value) => value + 1) : next();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Booking Calendar</h2>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedVenue} onChange={(e) => { setSelectedVenue(e.target.value); setSelectedDate(null); }} className="w-56">
            {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </Select>
          <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
        </div>
      </div>

      {/* View Toggle + Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-0.5">
          {(["month", "week", "day"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                viewMode === mode ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={navigatePrevious} aria-label={`Previous ${viewMode}`}><ChevronLeft className="h-4 w-4" /></Button>
          {viewMode === "week" ? (
            <span className="min-w-[180px] text-center text-sm font-semibold">
              {formatDate(startOfWeek)} – {formatDate(weekDays[6])}
            </span>
          ) : (
            <span className="min-w-[140px] text-center text-sm font-semibold">
              {MONTHS[month - 1]} {year}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={navigateNext} aria-label={`Next ${viewMode}`}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      {calendarError && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{calendarError}</p>}

      {/* Month View (read-only, click to jump to day) */}
      {viewMode === "month" && (
        <Card>
          <CardContent className="p-3">
            <div className="grid grid-cols-7 gap-px rounded-lg border bg-muted">
              {DAYS.map((d) => (
                <div key={d} className="bg-background p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
              ))}
              {calendarDays.map((d, i) => {
                if (d === null) return <div key={`e-${i}`} className="bg-background p-2" />;
                const key = dateKey(d);
                const dayBookings = dayBookingsForDate(key);
                const isToday = key === todayStr;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleDayClick(d)}
                    className={`relative bg-background p-2 text-left text-sm transition hover:bg-accent ${
                      isToday ? "ring-1 ring-primary" : ""
                    } ${selectedDate === key ? "bg-primary/10" : ""}`}
                  >
                    <span className={`font-medium ${isToday ? "text-primary" : ""}`}>{d}</span>
                    {dayBookings.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {dayBookings.slice(0, 3).map((b) => (
                          <div
                            key={b.id}
                            className={`h-1.5 w-full rounded-full ${
                              b.status === "CONFIRMED" ? "bg-blue-500" :
                              b.status === "COMPLETED" ? "bg-green-500" :
                              b.status === "CANCELLED" ? "bg-red-400" :
                              b.status === "PENDING" ? "bg-amber-400" : "bg-purple-400"
                            }`}
                          />
                        ))}
                        {dayBookings.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{dayBookings.length - 3} more</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Week View with Drag & Drop */}
      {viewMode === "week" && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <div className="flex border-b bg-muted/30 text-xs font-medium text-muted-foreground">
              <div className="w-16 shrink-0 p-2 text-right">Time</div>
              {weekDays.map((day, i) => {
                const key = weekDayDateKeys[i];
                const isToday = key === todayStr;
                return (
                  <div key={key} className={`flex-1 p-2 text-center ${isToday ? "font-bold text-primary" : ""}`}>
                    {DAYS[day.getDay()]} {day.getDate()}
                  </div>
                );
              })}
            </div>
            <div ref={gridRef} className="relative" style={{ height: 18 * 48 }}>
              {HOURS.map((h) => (
                <div key={h} className="flex border-t">
                  <div className="w-16 shrink-0 p-1 pr-2 text-right text-[10px] text-muted-foreground">
                    {h > 12 ? h - 12 : h}{h >= 12 ? "p" : "a"}
                  </div>
                  {weekDayDateKeys.map((dayKey, di) => {
                    const isDropTarget = dropTarget?.date === dayKey && dropTarget?.hour === h;
                    return (
                      <div
                        key={dayKey}
                        className={`flex-1 border-l transition-colors ${isDropTarget ? "bg-primary/15" : ""} ${dragBooking ? "cursor-copy" : ""}`}
                        onDragOver={(e) => handleDragOver(e, dayKey, h)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, dayKey, h)}
                      />
                    );
                  })}
                </div>
              ))}
              {weekDayDateKeys.map((dayKey, di) =>
                dayBookingsForDate(dayKey).map((b) => {
                  const top = bookingTimeToPercent(b.startTime);
                  const height = bookingTimeToPercent(b.endTime) - top;
                  const hasConflict = checkConflict(b);
                  return (
                    <div
                      key={b.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, b)}
                      onDragEnd={handleDragEnd}
                      className={`absolute left-16 right-0 mx-0.5 cursor-grab overflow-hidden rounded border px-1 py-0.5 text-[10px] transition hover:z-10 hover:shadow-md active:cursor-grabbing ${
                        STATUS_COLORS[b.status] || "bg-gray-100 border-gray-300"
                      } ${hasConflict ? "ring-2 ring-red-500" : ""} ${dragBooking?.id === b.id ? "opacity-40" : ""} ${dragBooking && dragBooking.id !== b.id ? "pointer-events-none" : ""}`}
                      style={{
                        top: `${top}%`,
                        height: `${Math.max(height, 2)}%`,
                        left: `${16 + di * ((100 - 16) / 7)}%`,
                        width: `${(100 - 16) / 7}%`,
                      }}
                      onMouseEnter={(e) => handleMouseEnter(b, e)}
                      onMouseLeave={handleMouseLeave}
                      onClick={() => handleBookingClick(b)}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open booking at ${formatTime(b.startTime)} on ${dayKey}`}
                      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); handleBookingClick(b); } }}
                    >
                      <span className="font-medium">{b.user?.firstName || "?"}</span>
                      <span className="ml-1">{formatTime(b.startTime)}</span>
                    </div>
                  );
                })
              )}
              {/* Ghost indicator */}
              {dropTarget && (
                <div
                  className="absolute left-16 right-0 z-20 rounded border-2 border-dashed border-primary bg-primary/10 pointer-events-none"
                  style={{
                    top: `${((dropTarget.hour - 6) / 18) * 100}%`,
                    height: `${(1 / 18) * 100}%`,
                  }}
                >
                  <span className="ml-1 text-[10px] font-semibold text-primary">
                    {dropTarget.hour > 12 ? dropTarget.hour - 12 : dropTarget.hour}{dropTarget.hour >= 12 ? "p" : "a"}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Day View with Drag & Drop */}
      {viewMode === "day" && selectedDate && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" />
              {formatDate(selectedDate)}
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {dayBookingsForDate(selectedDate).length} booking{dayBookingsForDate(selectedDate).length !== 1 ? "s" : ""}
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative" style={{ height: 18 * 48 }}>
              {HOURS.map((h) => {
                const isDropTarget = dropTarget?.date === selectedDate && dropTarget?.hour === h;
                return (
                  <div
                    key={h}
                    className={`flex border-t text-[11px] transition-colors ${isDropTarget ? "bg-primary/15" : ""} ${dragBooking ? "cursor-copy" : ""}`}
                    style={{ height: 48 }}
                    onDragOver={(e) => handleDragOver(e, selectedDate, h)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, selectedDate, h)}
                  >
                    <div className="w-16 shrink-0 p-1 pr-2 text-right text-muted-foreground">
                      {h > 12 ? h - 12 : h}{h >= 12 ? "p" : "a"}
                    </div>
                    <div className="flex-1 border-l" />
                  </div>
                );
              })}
              {dayBookingsForDate(selectedDate).map((b) => {
                const top = bookingTimeToPercent(b.startTime);
                const height = bookingTimeToPercent(b.endTime) - top;
                const hasConflict = checkConflict(b);
                return (
                  <motion.div
                    key={b.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    draggable
                    onDragStart={(e) => handleDragStart(e, b)}
                    onDragEnd={handleDragEnd}
                    className={`absolute left-16 right-2 cursor-grab rounded-lg border p-2 shadow-sm transition hover:shadow-md active:cursor-grabbing ${
                      STATUS_COLORS[b.status] || "bg-gray-100 border-gray-300"
                    } ${hasConflict ? "ring-2 ring-red-500" : ""} ${dragBooking?.id === b.id ? "opacity-40" : ""}`}
                    style={{ top: `${top}%`, height: `${Math.max(height, 4)}%`, minHeight: 48 }}
                    onMouseEnter={(e) => handleMouseEnter(b, e)}
                    onMouseLeave={handleMouseLeave}
                    onClick={() => handleBookingClick(b)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open booking at ${formatTime(b.startTime)} on ${selectedDate}`}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); handleBookingClick(b); } }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">
                        {b.user?.firstName} {b.user?.lastName}
                      </span>
                      <Badge variant="outline" className="text-[10px] bg-background/50">
                        {b.status}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span><Clock className="inline h-3 w-3 mr-0.5" />{formatTime(b.startTime)} – {formatTime(b.endTime)}</span>
                      <span><DollarSign className="inline h-3 w-3 mr-0.5" />{formatCurrency(b.totalAmount)}</span>
                    </div>
                    {b.turf && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        <MapPin className="inline h-3 w-3 mr-0.5" />{b.turf.name} • {b.turf.venue?.name || ""}
                      </div>
                    )}
                  </motion.div>
                );
              })}
              {/* Ghost indicator for day view */}
              {dropTarget && dropTarget.date === selectedDate && (
                <div
                  className="absolute left-16 right-2 z-20 rounded border-2 border-dashed border-primary bg-primary/10 pointer-events-none"
                  style={{
                    top: `${((dropTarget.hour - 6) / 18) * 100}%`,
                    height: `${(1 / 18) * 100}%`,
                    minHeight: 28,
                  }}
                >
                  <span className="ml-1 text-xs font-semibold text-primary">
                    {dropTarget.hour > 12 ? dropTarget.hour - 12 : dropTarget.hour}{dropTarget.hour >= 12 ? "p" : "a"}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Day selector fallback when no date selected in day mode */}
      {viewMode === "day" && !selectedDate && (
        <div className="flex flex-col items-center py-12 text-muted-foreground">
          <Calendar className="mb-2 h-8 w-8" />
          <p className="text-sm">Select a date from the month view</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setViewMode("month")}>
            Back to Month View
          </Button>
        </div>
      )}

      {isError ? (
        <ErrorState message="Couldn't load calendar." onRetry={refetch} />
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />)}
        </div>
      ) : null}

      {/* Hover Tooltip */}
      <AnimatePresence>
        {hoveredBooking && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-50 w-64 rounded-lg border bg-popover p-3 shadow-lg text-sm"
            style={{ left: hoverPos.x + 12, top: hoverPos.y - 10, pointerEvents: "none" }}
          >
            <p className="font-semibold">{hoveredBooking.user?.firstName} {hoveredBooking.user?.lastName}</p>
            <p className="text-xs text-muted-foreground">{hoveredBooking.user?.phone || ""}</p>
            <div className="mt-1.5 flex items-center gap-2 text-xs">
              <Clock className="h-3 w-3" />
              {formatTime(hoveredBooking.startTime)} – {formatTime(hoveredBooking.endTime)}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs">
              <MapPin className="h-3 w-3" />
              {hoveredBooking.turf?.name || "?"} • {hoveredBooking.turf?.venue?.name || ""}
            </div>
            <div className="mt-1.5">
              <Badge variant="outline" className="text-[10px]">{hoveredBooking.status}</Badge>
              <span className="ml-2 text-xs font-medium">{formatCurrency(hoveredBooking.totalAmount)}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Booking Detail Slide-in Drawer */}
      <AnimatePresence>
        {selectedBooking && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
              onClick={() => setSelectedBooking(null)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="fixed right-0 top-0 z-50 h-full w-full max-w-lg border-l bg-background shadow-2xl overflow-y-auto"
            >
              <div className="sticky top-0 flex items-center justify-between border-b bg-background/95 backdrop-blur p-4">
                <h2 className="text-lg font-bold">Booking Details</h2>
                <Button variant="ghost" size="icon" onClick={() => setSelectedBooking(null)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Booking #{selectedBooking.bookingNumber}</p>
                    <p className="text-xs text-muted-foreground">ID: {selectedBooking.id}</p>
                  </div>
                  <Badge className={
                    selectedBooking.status === "CONFIRMED" ? "bg-blue-500" :
                    selectedBooking.status === "COMPLETED" ? "bg-green-500" :
                    selectedBooking.status === "CANCELLED" ? "bg-red-500" :
                    selectedBooking.status === "PENDING" ? "bg-amber-500" : "bg-purple-500"
                  }>{selectedBooking.status}</Badge>
                </div>

                <div className="grid gap-4">
                  <div className="flex items-start gap-3 rounded-lg border p-4">
                    <User className="mt-0.5 h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{selectedBooking.user?.firstName} {selectedBooking.user?.lastName}</p>
                      <p className="text-sm text-muted-foreground">{selectedBooking.user?.email}</p>
                      {selectedBooking.user?.phone && (
                        <p className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />{selectedBooking.user.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border p-4">
                    <MapPin className="mt-0.5 h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{selectedBooking.turf?.venue?.name || "Venue"}</p>
                      <p className="text-sm text-muted-foreground">{selectedBooking.turf?.name} • {selectedBooking.turf?.size} • {selectedBooking.turf?.surface}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border p-4">
                    <Calendar className="mt-0.5 h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{formatDate(selectedBooking.date)}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatTime(selectedBooking.startTime)} – {formatTime(selectedBooking.endTime)}
                        <span className="ml-2">({selectedBooking.duration} min)</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border p-4">
                    <DollarSign className="mt-0.5 h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{formatCurrency(selectedBooking.totalAmount)}</p>
                      {selectedBooking.discountAmount > 0 && (
                        <p className="text-sm text-green-600">Discount: {formatCurrency(selectedBooking.discountAmount)}</p>
                      )}
                      {selectedBooking.couponCode && (
                        <p className="text-sm text-muted-foreground">Coupon: {selectedBooking.couponCode}</p>
                      )}
                      <p className="text-sm text-muted-foreground">Players: {selectedBooking.numPlayers}</p>
                    </div>
                  </div>

                  {selectedBooking.notes && (
                    <div className="rounded-lg border p-4">
                      <p className="text-sm font-medium">Notes</p>
                      <p className="mt-1 text-sm text-muted-foreground">{selectedBooking.notes}</p>
                    </div>
                  )}
                </div>

                {selectedBooking.status === "PENDING" && (
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={async () => {
                        try {
                          await api.patch(`/admin/bookings/${selectedBooking.id}/status`, { status: "CONFIRMED" });
                          queryClient.invalidateQueries({ queryKey: ["admin-calendar"] });
                          setSelectedBooking(null);
                        } catch {}
                      }}
                    >
                      Confirm Booking
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={async () => {
                        try {
                          await api.patch(`/admin/bookings/${selectedBooking.id}/status`, { status: "CANCELLED" });
                          queryClient.invalidateQueries({ queryKey: ["admin-calendar"] });
                          setSelectedBooking(null);
                        } catch {}
                      }}
                    >
                      Cancel Booking
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
