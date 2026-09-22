import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";

export function FollowButton({ type, entityId }: { type: "TEAM" | "PLAYER"; entityId: string }) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const { data: follows } = useQuery({ queryKey: ["fan-follows", user?.id], queryFn: () => api.get<Array<{ teamId: string | null; playerId: string | null; relatedTeamIds?: string[]; relatedPlayerIds?: string[] }>>("/league/fan/follows"), enabled: !!user });
  const [following, setFollowing] = useState(false);
  useEffect(() => { setFollowing(!!follows?.some(f => type === "TEAM" ? f.teamId === entityId || f.relatedTeamIds?.includes(entityId) : f.playerId === entityId || f.relatedPlayerIds?.includes(entityId))); }, [follows, type, entityId]);
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    if (!user) return;
    setBusy(true);
    try { const result = await api.post<{ following: boolean }>("/league/fan/follows/toggle", { type, entityId }); setFollowing(result.following); await cache.invalidateQueries({ queryKey: ["fan-follows"] }); } finally { setBusy(false); }
  };
  return <Button variant={following ? "default" : "secondary"} size="sm" disabled={!user || busy} onClick={toggle} className="gap-2"><Heart className={`h-4 w-4 ${following ? "fill-current" : ""}`} />{following ? "Following" : "Follow"}</Button>;
}
