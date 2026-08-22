import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageError, PageSkeleton } from "@/components/PageState";

export function GuestBookingPage() {
  const token = useMemo(() => new URLSearchParams(window.location.hash.slice(1)).get("token") || "", []);
  const [actionError, setActionError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const { data: booking, isLoading, isError, refetch } = useQuery({
    queryKey: ["guest-booking", token],
    queryFn: () => api.getGuestBooking<any>(token),
    enabled: !!token,
    retry: false,
  });

  if (!token) return <PageError title="Booking link missing" description="Open the complete guest management link supplied when the booking was created." action={<Button asChild><Link to="/booking">Book a turf</Link></Button>} />;
  if (isLoading) return <PageSkeleton />;
  if (isError || !booking) return <PageError title="Booking link unavailable" description="This link is invalid, expired, or the booking was archived." onRetry={() => void refetch()} action={<Button variant="outline" asChild><Link to="/booking">Browse venues</Link></Button>} />;

  const canCancel = ["PENDING", "CONFIRMED", "RESCHEDULED"].includes(booking.status);
  return <div className="mx-auto max-w-xl px-4 py-12">
    <Card>
      <CardHeader><CardTitle>Booking {booking.bookingNumber}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-muted-foreground">Status</dt><dd className="font-semibold">{booking.status}</dd></div>
          <div><dt className="text-muted-foreground">Total</dt><dd className="font-semibold">{formatCurrency(booking.totalAmount)}</dd></div>
          <div><dt className="text-muted-foreground">Venue</dt><dd className="font-semibold">{booking.turf?.venue?.name}</dd></div>
          <div><dt className="text-muted-foreground">Turf</dt><dd className="font-semibold">{booking.turf?.name}</dd></div>
          <div><dt className="text-muted-foreground">Date</dt><dd>{formatDate(booking.date)}</dd></div>
          <div><dt className="text-muted-foreground">Time</dt><dd>{booking.startTime}–{booking.endTime}</dd></div>
        </dl>
        {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
        {canCancel && <Button variant="destructive" disabled={cancelling} onClick={async () => {
          if (!window.confirm("Cancel this booking? This action releases the slot.")) return;
          try { setCancelling(true); setActionError(""); await api.cancelGuestBooking(token, "Cancelled by guest"); await refetch(); }
          catch (error: any) { setActionError(error.message || "Could not cancel booking"); }
          finally { setCancelling(false); }
        }}>{cancelling ? "Cancelling…" : "Cancel booking"}</Button>}
      </CardContent>
    </Card>
  </div>;
}
