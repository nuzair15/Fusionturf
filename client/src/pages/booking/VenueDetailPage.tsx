import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { formatDate, formatTime, formatCurrency } from "@/lib/utils";
import type { Venue, Turf, SlotAvailability } from "@/types";
import { MapPin, Phone, Mail, Clock, Calendar, Users, Star, ChevronLeft } from "lucide-react";

export function VenueDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [selectedTurf, setSelectedTurf] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedSlot, setSelectedSlot] = useState<SlotAvailability | null>(null);

  const { data: venue, isLoading } = useQuery({
    queryKey: ["venue", slug],
    queryFn: () => api.get<Venue>(`/bookings/venues/${slug}`),
    enabled: !!slug,
  });

  const { data: slots } = useQuery({
    queryKey: ["slots", selectedTurf, selectedDate],
    queryFn: () => api.get<SlotAvailability[]>(`/bookings/slots`, { turfId: selectedTurf!, date: selectedDate }),
    enabled: !!selectedTurf && !!selectedDate,
  });

  if (isLoading) {
    return <div className="mx-auto max-w-7xl px-4 py-8"><div className="h-96 animate-pulse rounded-xl bg-muted" /></div>;
  }

  if (!venue) return null;

  const turfs = venue.turfs || [];
  const selectedTurfData = turfs.find((t) => t.id === selectedTurf) || turfs[0];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Button variant="ghost" onClick={() => navigate("/booking")} className="mb-4 gap-1">
          <ChevronLeft className="h-4 w-4" /> Back to Venues
        </Button>

        <div className="relative mb-8 overflow-hidden rounded-2xl">
          <div className="aspect-[21/9] w-full bg-muted">
            <img src={venue.coverImage || "/placeholder.svg"} alt={venue.name} className="h-full w-full object-cover" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-6">
            <h1 className="text-3xl font-bold text-white">{venue.name}</h1>
            <p className="mt-1 flex items-center gap-1 text-white/80"><MapPin className="h-4 w-4" /> {venue.address}, {venue.city}</p>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left - Info */}
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{venue.description}</p>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  {venue.phone && (
                    <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {venue.phone}</div>
                  )}
                  {venue.email && (
                    <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {venue.email}</div>
                  )}
                  <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> {venue.openingTime} - {venue.closingTime}</div>
                </div>
              </CardContent>
            </Card>

            {/* Turfs */}
            <Card>
              <CardHeader>
                <CardTitle>Turfs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {turfs.map((turf) => (
                  <div
                    key={turf.id}
                    className={`cursor-pointer rounded-xl border p-4 transition-all ${selectedTurf === turf.id ? "border-primary bg-primary/5" : "hover:border-muted-foreground/20"}`}
                    onClick={() => { setSelectedTurf(turf.id); setSelectedSlot(null); }}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{turf.name}</h3>
                        <p className="text-sm text-muted-foreground">{turf.size} • {turf.surface}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{formatCurrency(turf.basePrice)}</p>
                        <p className="text-xs text-muted-foreground">per hour</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Gallery */}
            {venue.gallery && venue.gallery.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Gallery</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {venue.gallery.map((img) => (
                      <img key={img.id} src={img.imageUrl} alt={img.caption || ""} className="aspect-video rounded-lg object-cover" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Reviews */}
            {venue.reviews && venue.reviews.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Reviews</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {venue.reviews.map((review) => (
                    <div key={review.id} className="border-b pb-4 last:border-0">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                          {review.user.firstName[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{review.user.firstName} {review.user.lastName}</p>
                          <div className="flex gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={`h-3 w-3 ${i < review.rating ? "text-yellow-500" : "text-muted"}`} />
                            ))}
                          </div>
                        </div>
                      </div>
                      {review.comment && <p className="mt-2 text-sm text-muted-foreground">{review.comment}</p>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right - Booking */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Book a Slot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Select Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => { setSelectedDate(e.target.value); setSelectedSlot(null); }}
                    min={new Date().toISOString().split("T")[0]}
                    className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>

                {selectedTurf && (
                  <div>
                    <label className="text-sm font-medium">Available Slots</label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(slots || []).map((slot) => (
                        <button
                          key={slot.id}
                          onClick={() => setSelectedSlot(slot)}
                          className={`rounded-lg border p-2 text-center text-sm transition-all ${
                            selectedSlot?.id === slot.id
                              ? "border-primary bg-primary text-primary-foreground"
                              : "hover:border-muted-foreground/30"
                          }`}
                        >
                          <p>{formatTime(slot.startTime)}</p>
                          <p className="text-xs opacity-70">{formatCurrency(slot.price)}</p>
                        </button>
                      ))}
                      {(!slots || slots.length === 0) && (
                        <p className="col-span-2 py-4 text-center text-sm text-muted-foreground">
                          No available slots for this date
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {selectedSlot && (
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-sm font-medium">Booking Summary</p>
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      <p>{selectedTurfData?.name}</p>
                      <p>{formatDate(selectedDate)} • {formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)}</p>
                      <p className="text-lg font-bold text-foreground">{formatCurrency(selectedSlot.price)}</p>
                    </div>
                  </div>
                )}

                <Button
                  className="w-full"
                  disabled={!selectedSlot}
                  onClick={() => {
                    navigate("/dashboard");
                  }}
                >
                  Proceed to Book
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
