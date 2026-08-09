import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { Venue } from "@/types";
import { Calendar, MapPin, Star, ChevronLeft, Clock } from "lucide-react";
import { formatCurrency, formatTime } from "@/lib/utils";

export function BookingPage() {
  const navigate = useNavigate();
  const [mapOpen, setMapOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["venues"],
    queryFn: () => api.get<{ data: Venue[] }>("/bookings/venues", { limit: 10 }),
  });

  const venues = data?.data || [];

  if (isLoading) {
    return <div className="mx-auto max-w-7xl px-4 py-8"><div className="h-96 animate-pulse rounded-xl bg-muted" /></div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-4 gap-1">
          <ChevronLeft className="h-4 w-4" /> Back to Home
        </Button>

        <h1 className="text-3xl font-bold">Book a Turf</h1>
        <p className="mt-2 text-muted-foreground">Select a venue below to view available slots and book.</p>
        <div className="mt-5 flex items-center justify-between rounded-xl border bg-card p-3"><div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-primary" /><span>Find a pitch near you with the venue map</span></div><Button variant="outline" size="sm" onClick={() => setMapOpen((open) => !open)}>{mapOpen ? "Hide map" : "Show map"}</Button></div>
        {mapOpen && venues.some((venue) => venue.latitude && venue.longitude) && <div className="mt-4 overflow-hidden rounded-2xl border"><iframe title="Venue map" className="h-72 w-full" loading="lazy" src={`https://www.openstreetmap.org/export/embed.html?bbox=${Math.min(...venues.filter((v) => v.longitude).map((v) => v.longitude!)) - 0.03}%2C${Math.min(...venues.filter((v) => v.latitude).map((v) => v.latitude!)) - 0.03}%2C${Math.max(...venues.filter((v) => v.longitude).map((v) => v.longitude!)) + 0.03}%2C${Math.max(...venues.filter((v) => v.latitude).map((v) => v.latitude!)) + 0.03}&layer=mapnik`} /></div>}

        {venues.length === 0 ? (
          <div className="py-20 text-center">
            <h2 className="text-xl font-bold">No Venues Available</h2>
            <p className="mt-2 text-muted-foreground">Check back later for turf bookings.</p>
            <Button className="mt-4" onClick={() => navigate("/")}>Go Home</Button>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {venues.map((venue) => (
              <Card key={venue.id} className="cursor-pointer overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md" onClick={() => navigate(`/booking/${venue.slug}`)}>
                <div className="aspect-video w-full bg-muted">
                  <img src={venue.coverImage || "/placeholder.svg"} alt={venue.name} className="h-full w-full object-cover" />
                </div>
                <CardContent className="p-5">
                  <h2 className="text-lg font-bold">{venue.name}</h2>
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" /> {venue.city}{venue.state ? `, ${venue.state}` : ""}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {formatTime(venue.openingTime)} - {formatTime(venue.closingTime)}</span>
                    {venue.avgRating != null && (
                      <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-yellow-500" /> {venue.avgRating.toFixed(1)}</span>
                    )}
                  </div>
                  {venue.turfs && venue.turfs.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {venue.turfs.slice(0, 2).map((turf) => (
                        <div key={turf.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                          <span>{turf.name} ({turf.size})</span>
                          <span className="font-medium">{formatCurrency(turf.basePrice)}<span className="text-xs font-normal text-muted-foreground">/hr</span></span>
                        </div>
                      ))}
                      {venue.turfs.length > 2 && <p className="text-xs text-muted-foreground">+{venue.turfs.length - 2} more</p>}
                    </div>
                  )}
                  <Button size="sm" className="mt-4 w-full gap-2">
                    <Calendar className="h-4 w-4" /> View Slots
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
