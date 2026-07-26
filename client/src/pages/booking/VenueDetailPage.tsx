import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { Venue } from "@/types";
import { MapPin, Phone, Mail, Clock, ChevronLeft, CheckCircle } from "lucide-react";
import confetti from "canvas-confetti";

const TIME_SLOTS = ["06:00","07:00","08:00","09:00","10:00","11:00"];

export function VenueDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (done) {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    }
  }, [done]);

  const { data: venue, isLoading } = useQuery({
    queryKey: ["venue", slug],
    queryFn: () => api.get<Venue>(`/bookings/venues/${slug}`),
    enabled: !!slug,
  });

  const turf = venue?.turfs?.[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !date || !selectedSlot || !turf) {
      setError("Please fill in all fields");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.post("/bookings", {
        turfId: turf.id,
        date,
        startTime: selectedSlot,
        endTime: String(parseInt(selectedSlot.split(":")[0]) + 1).padStart(2, "0") + ":00",
        customerName: name,
        customerPhone: phone,
        customerEmail: email || undefined,
      });
      setDone(true);
    } catch (err: any) {
      setError(err.message || "Booking failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return <div className="mx-auto max-w-7xl px-4 py-8"><div className="h-96 animate-pulse rounded-xl bg-muted" /></div>;
  if (!venue) return null;

  if (done) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
        <h1 className="mt-4 text-2xl font-bold">Booking Submitted!</h1>
        <p className="mt-2 text-muted-foreground">We'll contact {name} at {phone} to confirm your slot.</p>
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
              <CardContent className="p-5 space-y-3">
                <h1 className="text-xl font-bold">{venue.name}</h1>
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" /> {venue.address}, {venue.city}</p>
                {venue.phone && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-4 w-4" /> {venue.phone}</p>}
                {venue.email && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="h-4 w-4" /> {venue.email}</p>}
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4" /> {venue.openingTime} - {venue.closingTime}</p>
                {turf && (
                  <div className="rounded-lg bg-primary/10 p-3 text-sm">
                    <p className="font-medium">{turf.name}</p>
                    <p className="text-muted-foreground">{turf.size} • {turf.surface}</p>
                    <p className="mt-1 font-bold text-primary">{formatCurrency(turf.basePrice)}<span className="text-xs font-normal">/hr</span></p>
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
                      <label className="text-sm font-medium">Phone *</label>
                      <Input type="tel" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Email (optional)</label>
                    <Input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Date *</label>
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={new Date().toISOString().split("T")[0]} required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Time Slot *</label>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {TIME_SLOTS.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={`rounded-lg border py-3 text-sm font-medium transition-all ${
                            selectedSlot === slot
                              ? "border-primary bg-primary text-primary-foreground"
                              : "hover:border-primary/50"
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && <p className="text-sm text-destructive">{error}</p>}

                  <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                    {submitting ? "Booking..." : `Confirm Booking${turf ? ` - ${formatCurrency(turf.basePrice)}` : ""}`}
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
