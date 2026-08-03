import { motion } from "framer-motion";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { formatDate, formatTime, formatCurrency } from "@/lib/utils";
import { buildBookingMessage } from "@/lib/bookingMessage";
import { openBookingInvoice } from "@/lib/invoice";
import type { Booking, Payment } from "@/types";
import {
  X, User, Phone, MapPin, DollarSign, CreditCard,
  FileText, Clock, Calendar, Edit2, Ban, Undo2, Printer,
  AlertTriangle, CheckCircle2, MessageCircle, Copy,
} from "lucide-react";

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(dateStr);
}

export function BookingDrawer({ booking, settings, onClose }: { booking: Booking; settings?: Record<string, string>; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [payments, setPayments] = useState<Payment[]>(booking.payments || []);
  const [totalAmount, setTotalAmount] = useState(booking.totalAmount);
  const [discountAmount, setDiscountAmount] = useState(booking.discountAmount || 0);
  const [discountInput, setDiscountInput] = useState(String((booking.discountAmount || 0) / 100 || ""));
  const [savingDiscount, setSavingDiscount] = useState(false);
  const statusColor = booking.status === "CONFIRMED" ? "bg-blue-500" :
    booking.status === "COMPLETED" ? "bg-green-500" :
    booking.status === "CANCELLED" ? "bg-red-500" :
    booking.status === "PENDING" ? "bg-amber-500" : "bg-purple-500";

  const handleAction = async (action: "confirm" | "cancel" | "refund") => {
    try {
      if (action === "confirm") await api.patch(`/admin/bookings/${booking.id}/status`, { status: "CONFIRMED" });
      else if (action === "cancel") await api.patch(`/admin/bookings/${booking.id}/status`, { status: "CANCELLED" });
      else if (action === "refund") await api.patch(`/admin/bookings/${booking.id}/refund`);
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      onClose();
    } catch {}
  };

  const markPaid = async () => {
    try {
      await api.patch(`/admin/bookings/${booking.id}/payment`, { method: paymentMethod });
      setPayments((prev) => prev.map((p) => (p.status === "PENDING" ? { ...p, status: "PAID", method: paymentMethod } : p)));
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
    } catch {}
  };

  const pendingCount = payments.filter((p) => p.status === "PENDING").length;

  const applyDiscount = async () => {
    const paise = Math.round((parseFloat(discountInput) || 0) * 100);
    setSavingDiscount(true);
    try {
      const res = await api.patch(`/admin/bookings/${booking.id}/discount`, { discountAmount: paise });
      const updated = (res as { data: { discountAmount?: number; totalAmount: number } }).data;
      setDiscountAmount(updated.discountAmount || 0);
      setTotalAmount(updated.totalAmount);
      setPayments((prev) => prev.map((p) => (p.status === "PENDING" ? { ...p, amount: updated.totalAmount } : p)));
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
    } catch {} finally {
      setSavingDiscount(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 250 }}
        className="fixed right-0 top-0 z-50 h-full w-full max-w-lg border-l bg-background shadow-2xl overflow-y-auto"
      >
        <div className="sticky top-0 flex items-center justify-between border-b bg-background/95 backdrop-blur p-4 z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold">Booking Details</h2>
            <Badge className={statusColor}>{booking.status}</Badge>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-5 space-y-5">
          {/* Customer */}
          <div className="flex items-start gap-3 rounded-lg border p-4">
            <User className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{booking.user?.firstName || "?"} {booking.user?.lastName || ""}</p>
              <p className="text-sm text-muted-foreground">{booking.user?.email || "—"}</p>
              {booking.user?.phone && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                  <Phone className="h-3.5 w-3.5" /> {booking.user.phone}
                </p>
              )}
            </div>
          </div>

          {/* Venue & Time */}
          <div className="flex items-start gap-3 rounded-lg border p-4">
            <MapPin className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="font-semibold">{booking.turf?.venue?.name || "Venue"}</p>
              <p className="text-sm text-muted-foreground">{booking.turf?.name} • {booking.turf?.size} • {booking.turf?.surface}</p>
              <div className="mt-1.5 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(booking.date)}</span>
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatTime(booking.startTime)} – {formatTime(booking.endTime)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Duration: {booking.duration} hr{booking.duration > 1 ? "s" : ""} • {booking.numPlayers} players</p>
            </div>
          </div>

          {/* Amount & Payment */}
          <div className="flex items-start gap-3 rounded-lg border p-4">
            <DollarSign className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-lg">{formatCurrency(totalAmount)}</p>
                {payments.length > 0 && (
                  <Badge variant={payments[0].status === "PAID" ? "default" : payments[0].status === "REFUNDED" ? "secondary" : "outline"}>
                    {payments[0].status}
                  </Badge>
                )}
              </div>
              {discountAmount > 0 && (
                <p className="text-sm text-green-600">Discount: –{formatCurrency(discountAmount)}</p>
              )}
              {booking.couponCode && (
                <p className="text-xs text-muted-foreground">Coupon: {booking.couponCode}</p>
              )}

              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    type="number"
                    min={0}
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    placeholder="Discount (₹)"
                    className="h-8"
                  />
                </div>
                <Button size="sm" variant="outline" onClick={applyDiscount} disabled={savingDiscount}>
                  Apply Discount
                </Button>
              </div>

              {/* Payment History */}
              {payments.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    <CreditCard className="h-3 w-3" /> Payments
                  </p>
                  {payments.map((p: Payment) => (
                    <div key={p.id} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium">{formatCurrency(p.amount)}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{p.method || "—"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.transactionId && <span className="text-[10px] text-muted-foreground">#{p.transactionId.slice(0, 8)}</span>}
                        <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {booking.notes && (
            <div className="flex items-start gap-3 rounded-lg border p-4">
              <FileText className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium">Notes</p>
                <p className="mt-1 text-sm text-muted-foreground">{booking.notes}</p>
              </div>
            </div>
          )}

          {/* WhatsApp Message */}
          {(() => {
            const msg = buildBookingMessage(booking);
            if (!msg) return null;
            const phone = booking.user?.phone?.replace(/[^0-9]/g, "");
            const copy = async () => {
              try {
                await navigator.clipboard.writeText(msg);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {}
            };
            return (
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" /> WhatsApp Message
                  </p>
                  <div className="flex items-center gap-2">
                    {copied && <span className="text-[11px] text-green-600">Copied!</span>}
                    <Button variant="outline" size="sm" onClick={copy}>
                      <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                    </Button>
                    {phone && (
                      <a href={`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm">
                          <MessageCircle className="mr-1 h-3.5 w-3.5" /> Open
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
                <div className="max-h-52 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">{msg}</div>
              </div>
            );
          })()}

          {/* Booking History Timeline */}
          <div className="rounded-lg border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1 mb-3">
              <Clock className="h-3 w-3" /> Booking History
            </p>
            <div className="space-y-0">
              {[
                { action: "Booking created", time: booking.createdAt, icon: CheckCircle2, color: "border-green-500 bg-green-500/20" },
                ...(booking.status === "CONFIRMED" || booking.status === "COMPLETED"
                  ? [{ action: "Booking confirmed", time: booking.updatedAt, icon: CheckCircle2, color: "border-blue-500 bg-blue-500/20" }]
                  : []),
                ...(booking.status === "CANCELLED"
                  ? [{ action: "Booking cancelled", time: booking.updatedAt, icon: Ban, color: "border-red-500 bg-red-500/20" }]
                  : []),
                ...(booking.status === "COMPLETED"
                  ? [{ action: "Booking completed", time: booking.updatedAt, icon: CheckCircle2, color: "border-green-500 bg-green-500/20" }]
                  : []),
              ].map((event, i, arr) => (
                <div key={i} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < arr.length - 1 && (
                    <div className="absolute left-[7px] top-4 h-full w-px bg-border" />
                  )}
                  <div className={`mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${event.color}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{event.action}</p>
                    <p className="text-xs text-muted-foreground">{event.time ? relativeTime(event.time) : "—"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</p>
            {pendingCount > 0 && (
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <p className="text-xs text-muted-foreground">Payment Method</p>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="CARD">Card</option>
                    <option value="NETBANKING">Net Banking</option>
                    <option value="WALLET">Wallet</option>
                  </select>
                </div>
                <Button onClick={markPaid} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="mr-1.5 h-4 w-4" /> Mark as Paid
                </Button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {booking.status === "PENDING" && (
                <Button onClick={() => handleAction("confirm")} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="mr-1.5 h-4 w-4" /> Confirm
                </Button>
              )}
              {(booking.status === "PENDING" || booking.status === "CONFIRMED") && (
                <Button variant="destructive" onClick={() => handleAction("cancel")}>
                  <Ban className="mr-1.5 h-4 w-4" /> Cancel
                </Button>
              )}
              {booking.status === "CONFIRMED" && (
                <Button variant="secondary" onClick={() => handleAction("refund")}>
                  <Undo2 className="mr-1.5 h-4 w-4" /> Refund
                </Button>
              )}
              <Button variant="outline" onClick={() => openBookingInvoice(booking, settings || {})}>
                <Printer className="mr-1.5 h-4 w-4" /> Print Invoice
              </Button>
              {(() => {
                const phone = booking.user?.phone?.replace(/[^0-9]/g, "");
                const msg = buildBookingMessage(booking);
                if (!phone || !msg) return null;
                return (
                  <a href={`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" className="w-full">
                    <Button variant="outline" className="w-full">
                      <MessageCircle className="mr-1.5 h-4 w-4" /> Send WhatsApp
                    </Button>
                  </a>
                );
              })()}
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
