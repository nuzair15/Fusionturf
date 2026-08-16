import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { Venue, Booking } from "@/types";
import { MapPin, Phone, Mail, Clock, ChevronLeft, CheckCircle, Info } from "lucide-react";
import confetti from "canvas-confetti";
import { PageError, PageSkeleton } from "@/components/PageState";

function formatAmPm(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function generateSlots(open: string, close: string): string[] {
  const [oh, om] = open.split(":").map(Number);
  const [ch, cm] = close.split(":").map(Number);
  const start = oh * 60 + om;
  const end = ch * 60 + cm;
  const slots: string[] = [];
  for (let t = start; t < end; t += 30) {
    slots.push(String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0"));
  }
  return slots;
}

export function VenueDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMessage, setCouponMessage] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [startSlot, setStartSlot] = useState("");
  const [endSlot, setEndSlot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [selectedTurfId, setSelectedTurfId] = useState<string>("");

  useEffect(() => {
    if (done) {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    }
  }, [done]);

  const { data: venue, isLoading, isError, refetch } = useQuery({
    queryKey: ["venue", slug],
    queryFn: () => api.get<Venue>(`/bookings/venues/${slug}`),
    enabled: !!slug,
  });

  useEffect(() => {
    if (venue?.turfs?.length && !selectedTurfId) {
      setSelectedTurfId(venue.turfs[0].id);
    }
  }, [venue, selectedTurfId]);

  const turf = venue?.turfs?.find((t) => t.id === selectedTurfId);

  const computedPrice = useMemo(() => {
    if (!turf) return 0;
    let price = turf.basePrice;
    if (date) {
      const day = new Date(date).getDay();
      if (day === 0 || day === 6) {
        price = turf.weekendPrice || turf.basePrice;
      }
    }
    if (startSlot) {
      const hour = parseInt(startSlot.split(":")[0], 10);
      if (hour >= 17 && hour <= 21) {
        price = turf.peakPrice || price;
      }
    }
    return price;
  }, [turf, date, startSlot]);

  const computedTotal = useMemo(() => {
    if (!startSlot || !endSlot) return 0;
    const startMin = parseInt(startSlot.slice(0, 2), 10) * 60 + parseInt(startSlot.slice(3), 10);
    const endMin = parseInt(endSlot.slice(0, 2), 10) * 60 + parseInt(endSlot.slice(3), 10);
    const duration = endMin - startMin;
    const hours = turf?.halfHourBilling
      ? Math.ceil(duration / 30) / 2
      : Math.ceil(duration / 60);
    return computedPrice * hours;
  }, [startSlot, endSlot, computedPrice, turf?.halfHourBilling]);

  const { data: bookedData } = useQuery({
    queryKey: ["booked-slots", selectedTurfId, date],
    queryFn: () => api.get<Booking[]>(`/bookings/booked-slots/${selectedTurfId}?date=${date}`),
    enabled: !!selectedTurfId && !!date,
  });

  const bookedSlots = useMemo(() => {
    if (!bookedData) return [];
    const slots: string[] = [];
    for (const b of bookedData) {
      let t = b.startTime;
      while (t < b.endTime) {
        slots.push(t);
        t = addMinutes(t, 30);
      }
    }
    return slots;
  }, [bookedData]);

  const opening = venue?.openingTime || "06:00";
  const closing = venue?.closingTime || "23:00";
  const lastBooking = venue?.lastBookingTime || closing;
  const lastStart = lastBooking < closing ? lastBooking : addMinutes(closing, -30);

  // Start slots: from opening up to and including the last booking time
  const startTimeSlots = useMemo(() => {
    return generateSlots(opening, addMinutes(lastStart, 30));
  }, [opening, lastStart]);

  // End slots: from start+30min up to and including closing time
  const endTimeSlots = useMemo(() => {
    if (!startSlot) return [];
    return generateSlots(addMinutes(startSlot, 30), addMinutes(closing, 30));
  }, [startSlot, closing]);

  const isSlotBooked = (slot: string) => bookedSlots.includes(slot);

  // A slot is invalid as an end time if [startSlot, slot) overlaps any existing booking
  const isEndSlotInvalid = (slot: string) => {
    if (!bookedData || !startSlot) return false;
    return bookedData.some((b) => startSlot < b.endTime && slot > b.startTime);
  };

  const validEndSlots = useMemo(() => {
    if (!startSlot) return [];
    return endTimeSlots.filter((s) => !isEndSlotInvalid(s));
  }, [startSlot, endTimeSlots, bookedData]);

  useEffect(() => {
    if (endSlot && (!startSlot || !endTimeSlots.includes(endSlot) || isEndSlotInvalid(endSlot))) {
      setEndSlot("");
    }
  }, [startSlot, endSlot, endTimeSlots, bookedData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !date || !startSlot || !endSlot || !turf) {
      setError("Please fill in all fields");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.post("/bookings", {
        turfId: selectedTurfId,
        date,
        startTime: startSlot,
        endTime: endSlot,
        customerName: name,
        customerPhone: phone,
        customerEmail: email || undefined,
        couponCode: couponCode.trim() || undefined,
      });
      setDone(true);
    } catch (err: any) {
      setError(err.message || "Booking failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return <PageSkeleton />;
  if (isError || !venue) return <PageError title="This venue isn't available" description="It may have been removed or there was a problem loading its booking details." onRetry={() => void refetch()} action={<Button variant="outline" onClick={() => navigate("/booking")}>Browse venues</Button>} />;

  if (done) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
        <h1 className="mt-4 text-2xl font-bold">Booking Submitted!</h1>
        <p className="mt-2 text-muted-foreground">We'll contact {name} at {phone} to confirm your slot.</p>
        <p className="mt-1 text-sm text-muted-foreground">You will receive a confirmation call or text once your booking is verified.</p>
        <Button className="mt-6" onClick={() => navigate("/")}>Back to Home</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Button variant="ghost" onClick={() => navigate("/booking")} className="mb-4 gap-1">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>

        <div className="grid gap-8 lg:grid-cols-5">
          {/* Venue Info */}
          <div className="lg:col-span-2">
            <Card className="sticky top-28">
              <div className="aspect-video w-full overflow-hidden rounded-t-xl bg-muted">
                <img src={venue.coverImage || "/placeholder.svg"} alt={venue.name} className="h-full w-full object-cover" />
              </div>
              <CardContent className="space-y-3 p-5">
                <h1 className="text-xl font-bold">{venue.name}</h1>
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" /> {venue.address}, {venue.city}</p>
                {venue.phone && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-4 w-4" /> {venue.phone}</p>}
                {venue.email && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="h-4 w-4" /> {venue.email}</p>}
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4" /> {formatAmPm(venue.openingTime)} - {formatAmPm(venue.closingTime)}{venue.lastBookingTime ? <span className="text-xs">(last booking at {formatAmPm(venue.lastBookingTime)})</span> : null}</p>
                {venue.turfs && venue.turfs.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Turf</label>
                    {venue.turfs.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => { setSelectedTurfId(t.id); setStartSlot(""); setEndSlot(""); }}
                        className={`w-full rounded-lg border p-3 text-left text-sm transition ${
                          selectedTurfId === t.id
                            ? "border-primary bg-primary/10"
                            : "hover:border-primary/50"
                        }`}
                      >
                        <p className="font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.size} &bull; {t.surface}</p>
                        <p className="mt-0.5 font-bold text-primary">{formatCurrency(t.basePrice)}<span className="text-xs font-normal">/hr</span>
                          {(t.weekendPrice || t.peakPrice) && <span className="ml-2 text-[10px] font-normal text-muted-foreground">(weekend/peak rates apply)</span>}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Booking Form */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader><CardTitle>Book Your Slot</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Your Name *</label>
                      <Input placeholder="Enter your name" value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Phone Number *</label>
                      <Input type="tel" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                      <p className="text-xs text-muted-foreground"><Info className="mr-0.5 inline h-3 w-3" /> It is recommended to call the turf to confirm your booking.</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Email (optional)</label>
                    <Input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Date *</label>
                  <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setStartSlot(""); setEndSlot(""); setCouponDiscount(0); setCouponMessage(""); }} min={new Date().toISOString().split("T")[0]} required />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Start Time *</label>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                      {startTimeSlots.map((slot) => {
                        const booked = isSlotBooked(slot);
                        return (
                          <button
                            key={slot}
                            type="button"
                            disabled={booked}
                            onClick={() => { setStartSlot(slot); setEndSlot(""); setCouponDiscount(0); setCouponMessage(""); }}
                            className={`rounded-lg border py-3 text-sm font-medium transition-all ${
                              startSlot === slot
                                ? "border-primary bg-primary text-primary-foreground"
                                : booked
                                  ? "cursor-not-allowed border-destructive/30 bg-destructive/10 text-destructive/50 line-through"
                                  : "hover:border-primary/50"
                            }`}
                          >
                            {formatAmPm(slot)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {startSlot && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">End Time *</label>
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                        {endTimeSlots.map((slot) => {
                            const invalid = isEndSlotInvalid(slot);
                            return (
                              <button
                                key={slot}
                                type="button"
                                disabled={invalid}
                                onClick={() => setEndSlot(slot)}
                                className={`rounded-lg border py-3 text-sm font-medium transition-all ${
                                  endSlot === slot
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : invalid
                                      ? "cursor-not-allowed border-destructive/30 bg-destructive/10 text-destructive/50 line-through"
                                      : "hover:border-primary/50"
                                }`}
                              >
                                {formatAmPm(slot)}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {startSlot && endSlot && (
                    <div className="rounded-lg bg-primary/5 p-3 text-sm">
                      <p className="font-medium">Booking Summary</p>
                      <p className="text-muted-foreground">{formatAmPm(startSlot)} - {formatAmPm(endSlot)} on {new Date(date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</p>
                      <div className="mt-1 space-y-0.5">
                        <p className="text-xs text-muted-foreground">{formatCurrency(computedPrice)} × {((parseInt(endSlot.slice(0, 2), 10) * 60 + parseInt(endSlot.slice(3), 10) - (parseInt(startSlot.slice(0, 2), 10) * 60 + parseInt(startSlot.slice(3), 10))) / 60).toFixed(1)} hr = <span className="font-semibold text-foreground">{formatCurrency(computedTotal)}</span></p>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Input value={couponCode} onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponDiscount(0); setCouponMessage(""); }} placeholder="Coupon code" className="h-9" />
                        <Button type="button" variant="outline" className="h-9" onClick={async () => {
                          try {
                            const result = await api.post<{ discountAmount: number; totalAmount: number }>("/bookings/validate-coupon", { code: couponCode, turfId: selectedTurfId, date, startTime: startSlot, endTime: endSlot });
                            setCouponDiscount(result.discountAmount); setCouponMessage(`Coupon applied: -${formatCurrency(result.discountAmount)}`);
                          } catch (err: any) { setCouponDiscount(0); setCouponMessage(err.message || "Invalid coupon"); }
                        }} disabled={!couponCode.trim()}>Apply</Button>
                      </div>
                      {couponMessage && <p className={`text-xs ${couponDiscount ? "text-green-600" : "text-destructive"}`}>{couponMessage}</p>}
                      {couponDiscount > 0 && <p className="text-sm font-semibold">Payable: {formatCurrency(computedTotal - couponDiscount)}</p>}
                      {computedPrice !== turf?.basePrice && (
                        <p className="mt-0.5 text-[11px] text-amber-600">Weekend or peak hour pricing applied</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">You will receive a confirmation call or text once your booking is verified.</p>
                    </div>
                  )}

                  {error && <p className="text-sm text-destructive">{error}</p>}

                  <Button type="submit" className="w-full" size="lg" disabled={submitting || !startSlot || !endSlot}>
                    {submitting ? "Booking..." : `Confirm Booking${turf && computedTotal ? ` - ${formatCurrency(computedTotal)}` : ""}`}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  return String(Math.floor(total / 60) % 24).padStart(2, "0") + ":" + String(total % 60).padStart(2, "0");
}
