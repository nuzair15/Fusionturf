import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { Venue } from "@/types";
import { MapPin, Star, Search, ChevronRight } from "lucide-react";

export function BookingPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["venues", search],
    queryFn: () => api.get<{ data: Venue[] }>("/bookings/venues", { limit: 20, city: search || undefined }),
  });

  const venues = data?.data || [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Book a Turf</h1>
          <p className="mt-2 text-muted-foreground">Find and book premium football turfs near you</p>
        </div>

        <div className="relative mb-8 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {venues.map((venue) => (
              <Card
                key={venue.id}
                className="cursor-pointer overflow-hidden transition-all hover:shadow-lg"
                onClick={() => navigate(`/booking/${venue.slug}`)}
              >
                <div className="aspect-video w-full bg-muted">
                  <img src={venue.coverImage || "/placeholder.svg"} alt={venue.name} className="h-full w-full object-cover" />
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold">{venue.name}</h3>
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" /> {venue.city}, {venue.state}
                  </p>
                  <div className="mt-3 flex items-center gap-4 text-sm">
                    <span>{venue.turfs?.length || 0} turfs</span>
                    {venue.avgRating && (
                      <span className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 text-yellow-500" /> {venue.avgRating.toFixed(1)}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
