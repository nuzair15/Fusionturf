import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { ActivityLog, PaginatedResponse } from "@/types";
import {
  Clock, CreditCard, Calendar, UserPlus, Activity,
  MapPin, Newspaper, Handshake, RefreshCw,
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
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const ACTIVITY_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  "payment": { icon: CreditCard, color: "border-green-500 bg-green-500/20 text-green-600", label: "Payment received" },
  "booking": { icon: Calendar, color: "border-blue-500 bg-blue-500/20 text-blue-600", label: "Booking created" },
  "player": { icon: UserPlus, color: "border-purple-500 bg-purple-500/20 text-purple-600", label: "Player updated" },
  "fixture": { icon: Activity, color: "border-orange-500 bg-orange-500/20 text-orange-600", label: "Fixture generated" },
  "venue": { icon: MapPin, color: "border-teal-500 bg-teal-500/20 text-teal-600", label: "Venue edited" },
  "news": { icon: Newspaper, color: "border-pink-500 bg-pink-500/20 text-pink-600", label: "News published" },
  "sponsor": { icon: Handshake, color: "border-indigo-500 bg-indigo-500/20 text-indigo-600", label: "Sponsor added" },
};

function getActivityConfig(action: string, entity: string) {
  const lower = `${action} ${entity}`.toLowerCase();
  for (const [key, config] of Object.entries(ACTIVITY_CONFIG)) {
    if (lower.includes(key)) return config;
  }
  return {
    icon: RefreshCw,
    color: "border-muted-foreground bg-muted text-muted-foreground",
    label: `${action} ${entity}`,
  };
}

export function ActivityFeed() {
  const { data, isLoading, isRefetching } = useQuery({
    queryKey: ["admin-activity-feed"],
    queryFn: () => api.get<PaginatedResponse<ActivityLog>>("/admin/activity-logs", { limit: "30" }),
    refetchInterval: 15000,
    staleTime: 5000,
  });

  const logs = data?.data || [];

  return (
    <Card className="border-none shadow-sm bg-gradient-to-br from-card to-muted/30">
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-primary" />
          Activity Feed
        </CardTitle>
        <div className="flex items-center gap-2">
          {isRefetching && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            >
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            </motion.div>
          )}
          <Badge variant="outline" className="text-[10px]">
            Live
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="max-h-[500px] overflow-y-auto pr-1">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-muted-foreground">
            <Clock className="mb-2 h-8 w-8" />
            <p className="text-sm">No activity yet</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {logs.map((log, i) => {
              const config = getActivityConfig(log.action, log.entity);
              const Icon = config.icon;
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -20, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: "auto" }}
                  exit={{ opacity: 0, x: 20, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="relative flex gap-3 pb-3 last:pb-0"
                >
                  {i < logs.length - 1 && (
                    <div className="absolute left-[15px] top-8 h-full w-px bg-border" />
                  )}
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${config.color}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight">
                      <span className="text-foreground">{config.label}</span>
                      {log.entity && !log.entity.startsWith(log.action) && (
                        <span className="text-muted-foreground"> — {log.entity}</span>
                      )}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{relativeTime(log.createdAt)}</span>
                      {log.user && (
                        <>
                          <span>•</span>
                          <span className="truncate">{log.user.firstName} {log.user.lastName}</span>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </CardContent>
    </Card>
  );
}
