import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Venue, Booking } from "@/types";
import { MapPin, Phone, Mail, Clock, ChevronLeft, CheckCircle, Info } from "lucide-react";
import confetti from "canvas-confetti";
import { PageError, PageSkeleton } from "@/components/PageState";
import { businessDateKey } from "@/lib/fixtures";

function formatAmPm(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}
interface AvailableSlot { startTime: string; endTime: string; startAt: string; endAt: string; }
interface BookingQuote { baseAmount: number; servicesTotal: number; discountAmount: number; totalAmount: number; currency: string; duration: number; priceOverride?: { price: number; reason?: string } | null; }
interface BookingResult { booking: Booking; guestManagementToken?: string | null; idempotencyKey?: string; }

export function VenueDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [date, setDate] = useState(businessDateKey());
  const [startSlot, setStartSlot] = useState("");
  const [endSlot, setEndSlot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BookingResult | null>(null);
  const [error, setError] = useState("");
  const [selectedTurfId, setSelectedTurfId] = useState<string>("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const idempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (result) {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    }
  }, [result]);

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

  const availability = useQuery({
    queryKey: ["booking-availability", selectedTurfId, date],
    queryFn: () => api.get<AvailableSlot[]>("/bookings/slots", { turfId: selectedTurfId, date }),
    enabled: !!selectedTurfId && !!date,
    retry: 1,
  });

  const validEndSlots = useMemo(() => {
    if (!startSlot || !availability.data) return [];
    const sorted = [...availability.data].sort((a, b) => a.startAt.localeCompare(b.startAt));
    const startIndex = sorted.findIndex((slot) => slot.startTime === startSlot);
    if (startIndex < 0) return [];
    const ends: string[] = [];
    let expected = startSlot;
    for (let index = startIndex; index < sorted.length && sorted[index].startTime === expected; index += 1) {
      ends.push(sorted[index].endTime);
      expected = sorted[index].endTime;
    }
    return ends;
  }, [startSlot, availability.data]);

  const quoteInput = useMemo(() => ({
    turfId: selectedTurfId,
    date,
    startTime: startSlot,
    endTime: endSlot,
    ...(appliedCoupon ? { couponCode: appliedCoupon } : {}),
    services: selectedServices.map((id) => ({ id, quantity: 1 })),
  }), [selectedTurfId, date, startSlot, endSlot, appliedCoupon, selectedServices]);

  const quote = useQuery({
    queryKey: ["booking-quote", quoteInput],
    queryFn: () => api.post<BookingQuote>("/bookings/quote", quoteInput),
    enabled: !!selectedTurfId && !!date && !!startSlot && !!endSlot,
    retry: false,
  });

  useEffect(() => { idempotencyKeyRef.current = null; }, [selectedTurfId, date, startSlot, endSlot, appliedCoupon, selectedServices]);

  useEffect(() => {
    if (endSlot && (!startSlot || !validEndSlots.includes(endSlot))) {
      setEndSlot("");
    }
  }, [startSlot, endSlot, validEndSlots]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !date || !startSlot || !endSlot || !turf) {
      setError("Please fill in all fields");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      if (!quote.data) throw new Error("Wait for the server price quote before booking");
      idempotencyKeyRef.current ||= crypto.randomUUID();
      const created = await api.post<BookingResult>("/bookings", {
        turfId: selectedTurfId,
        date,
        startTime: startSlot,
        endTime: endSlot,
        customerName: name,
        customerPhone: phone,
        customerEmail: email || undefined,
        couponCode: appliedCoupon || undefined,
        services: selectedServices.map((id) => ({ id, quantity: 1 })),
      }, { "Idempotency-Key": idempotencyKeyRef.current });
      setResult(created);
    } catch (err: any) {
      setError(err.message || "Booking failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return <PageSkeleton />;
  if (isError || !venue) return <PageError title="This venue isn't available" description="It may have been removed or there was a problem loading its booking details." onRetry={() => void refetch()} action={<Button variant="outline" onClick={() => navigate("/booking")}>Browse venues</Button>} />;

  if (result) {
    const managementUrl = result.guestManagementToken ? `${window.location.origin}/booking/manage#token=${encodeURIComponent(result.guestManagementToken)}` : null;
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
        <h1 className="mt-4 text-2xl font-bold">Booking Submitted!</h1>
        <p className="mt-2 text-lg font-semibold">Booking #{result.booking.bookingNumber}</p>
        <p className="mt-1 text-muted-foreground">Status: {result.booking.status} · Total: {formatCurrency(result.booking.totalAmount)}</p>
        <p className="mt-1 text-sm text-muted-foreground">Your request is pending until venue staff confirms it.</p>
        {managementUrl && <a href={managementUrl} className="mt-4 block break-all rounded-lg border p-3 text-sm font-medium text-primary hover:bg-muted">Manage or cancel this guest booking</a>}
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
                        onClick={() => { setSelectedTurfId(t.id); setStartSlot(""); setEndSlot(""); setSelectedServices([]); setAppliedCoupon(""); }}
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
                  <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setStartSlot(""); setEndSlot(""); setAppliedCoupon(""); }} min={businessDateKey()} required />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Start Time *</label>
                    {availability.isLoading ? <p role="status" className="rounded-lg border p-4 text-sm text-muted-foreground">Checking live availability…</p> : availability.isError ? <div role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">Availability could not be verified. <Button type="button" size="sm" variant="outline" className="ml-2" onClick={() => availability.refetch()}>Retry</Button></div> : <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                      {(availability.data || []).map((slot) => {
                        return (
                          <button
                            key={slot.startAt}
                            type="button"
                            onClick={() => { setStartSlot(slot.startTime); setEndSlot(""); setAppliedCoupon(""); }}
                            className={`rounded-lg border py-3 text-sm font-medium transition-all ${
                              startSlot === slot.startTime
                                ? "border-primary bg-primary text-primary-foreground"
                                : "hover:border-primary/50"
                            }`}
                          >
                            {formatAmPm(slot.startTime)}
                          </button>
                        );
                      })}
                      {availability.data?.length === 0 && <p className="col-span-full py-4 text-sm text-muted-foreground">No bookable times remain for this date.</p>}
                    </div>}
                  </div>

                  {startSlot && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">End Time *</label>
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                        {validEndSlots.map((slot) => {
                            return (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => setEndSlot(slot)}
                                className={`rounded-lg border py-3 text-sm font-medium transition-all ${
                                  endSlot === slot
                                    ? "border-primary bg-primary text-primary-foreground"
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
                      {/* Legacy client-side pricing is intentionally retained only in history;
                          the rendered quote below is entirely server-authoritative.
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
                      */}
                      <p className="text-muted-foreground">{formatAmPm(startSlot)} - {formatAmPm(endSlot)} on {formatDate(date)}</p>
                      {turf?.services?.length ? <fieldset className="mt-3 space-y-2"><legend className="text-xs font-semibold">Optional services</legend>{turf.services.map((service) => <label key={service.id} className="flex cursor-pointer items-center justify-between rounded-md border bg-background p-2"><span><input type="checkbox" className="mr-2" checked={selectedServices.includes(service.id)} onChange={(event) => setSelectedServices((current) => event.target.checked ? [...current, service.id] : current.filter((id) => id !== service.id))} />{service.name}</span><span>{formatCurrency(service.price)}</span></label>)}</fieldset> : null}
                      {quote.isLoading && <p role="status" className="mt-2 text-xs text-muted-foreground">Calculating the final server price…</p>}
                      {quote.isError && <p role="alert" className="mt-2 text-xs text-destructive">{(quote.error as Error).message}</p>}
                      {quote.data && <div className="mt-2 space-y-1 border-t pt-2 text-xs"><p className="flex justify-between"><span>Slot</span><span>{formatCurrency(quote.data.baseAmount)}</span></p>{quote.data.servicesTotal > 0 && <p className="flex justify-between"><span>Services</span><span>{formatCurrency(quote.data.servicesTotal)}</span></p>}{quote.data.discountAmount > 0 && <p className="flex justify-between text-green-600"><span>Discount</span><span>-{formatCurrency(quote.data.discountAmount)}</span></p>}<p className="flex justify-between text-sm font-bold"><span>Total</span><span>{formatCurrency(quote.data.totalAmount)}</span></p>{quote.data.priceOverride && <p className="text-amber-600">Special pricing: {quote.data.priceOverride.reason || "venue override"}</p>}</div>}
                      <div className="mt-3 flex gap-2">
                        <Input value={couponCode} onChange={(event) => { setCouponCode(event.target.value.toUpperCase()); setAppliedCoupon(""); }} placeholder="Coupon code" className="h-9" />
                        <Button type="button" variant="outline" className="h-9" onClick={() => setAppliedCoupon(couponCode.trim())} disabled={!couponCode.trim() || quote.isLoading}>Apply</Button>
                      </div>
                      {appliedCoupon && quote.data?.discountAmount ? <p className="text-xs text-green-600">Coupon {appliedCoupon} applied.</p> : null}
                      <p className="mt-1 text-xs text-muted-foreground">You will receive a confirmation call or text once your booking is verified.</p>
                    </div>
                  )}

                  {error && <p className="text-sm text-destructive">{error}</p>}

                  <Button type="submit" className="w-full" size="lg" disabled={submitting || !startSlot || !endSlot || !quote.data || quote.isFetching}>
                    {submitting ? "Booking..." : `Submit Booking Request${quote.data ? ` - ${formatCurrency(quote.data.totalAmount)}` : ""}`}
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
