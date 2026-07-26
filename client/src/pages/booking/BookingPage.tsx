import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { Venue } from "@/types";
import { Calendar, MapPin, Star, ChevronLeft } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export function BookingPage() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["venues"],
    queryFn: () => api.get<{ data: Venue[] }>("/bookings/venues", { limit: 10 }),
  });

  const venue = (data?.data || [])[0];

  if (isLoading) {
    return <div className="mx-auto max-w-7xl px-4 py-8"><div className="h-96 animate-pulse rounded-xl bg-muted" /></div>;
  }

  if (!venue) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">No Venues Available</h1>
        <p className="mt-2 text-muted-foreground">Check back later for turf bookings.</p>
        <Button className="mt-4" onClick={() => navigate("/")}>Go Home</Button>
      </div>
    );
  }

  const turfCount = venue.turfs?.length || 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-4 gap-1">
          <ChevronLeft className="h-4 w-4" /> Back to Home
        </Button>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left - Venue Highlight */}
          <div>
            <h1 className="text-3xl font-bold">Book Fusion Turf</h1>
            <p className="mt-2 text-muted-foreground">Our premium football turf — book your slot now</p>

            <Card className="mt-6 overflow-hidden transition-all hover:shadow-md">
              <div className="aspect-video w-full bg-muted">
                <img src={venue.coverImage || "/placeholder.svg"} alt={venue.name} className="h-full w-full object-cover" />
              </div>
              <CardContent className="p-6">
                <h2 className="text-xl font-bold">{venue.name}</h2>
                <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" /> {venue.city}, {venue.state}
                </p>
                {venue.description && <p className="mt-3 text-sm text-muted-foreground">{venue.description}</p>}
                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  <span className="rounded-lg bg-primary/10 px-3 py-1.5 font-medium text-primary">{turfCount} Turf{turfCount !== 1 ? "s" : ""}</span>
                  {venue.avgRating && (
                    <span className="flex items-center gap-1 rounded-lg bg-muted px-3 py-1.5">
                      <Star className="h-4 w-4 text-yellow-500" /> {venue.avgRating.toFixed(1)}
                    </span>
                  )}
                  <span className="rounded-lg bg-muted px-3 py-1.5">{venue.openingTime} - {venue.closingTime}</span>
                </div>
                <Button size="lg" className="mt-6 w-full gap-2" onClick={() => navigate(`/booking/${venue.slug}`)}>
                  <Calendar className="h-5 w-5" /> View Slots & Book Now
                </Button>
              </CardContent>
            </Card>

            {venue.turfs && venue.turfs.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="font-semibold">Available Turfs</h3>
                {venue.turfs.map((turf) => (
                  <div key={turf.id} className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">{turf.name}</p>
                      <p className="text-sm text-muted-foreground">{turf.size} • {turf.surface}</p>
                    </div>
                    <p className="text-lg font-bold">{formatCurrency(turf.basePrice)}<span className="text-xs font-normal text-muted-foreground">/hr</span></p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right - Quick Info */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold">Why Book With Us?</h3>
                <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2"><Calendar className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Easy online booking with instant confirmation</li>
                  <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Premium location with easy access</li>
                  <li className="flex items-start gap-2"><Star className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Well-maintained turfs with top facilities</li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground">Looking for league matches and team stats?</p>
                <Button variant="outline" className="mt-3" onClick={() => navigate("/league")}>Visit League Section</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
