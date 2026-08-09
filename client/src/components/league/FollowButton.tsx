import { useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";

export function FollowButton({ type, entityId }: { type: "TEAM" | "PLAYER"; entityId: string }) {
  const { user } = useAuth();
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    if (!user) return;
    setBusy(true);
    try { const result = await api.post<{ following: boolean }>("/league/fan/follows/toggle", { type, entityId }); setFollowing(result.following); } finally { setBusy(false); }
  };
  return <Button variant={following ? "default" : "secondary"} size="sm" disabled={!user || busy} onClick={toggle} className="gap-2"><Heart className={`h-4 w-4 ${following ? "fill-current" : ""}`} />{following ? "Following" : "Follow"}</Button>;
}
