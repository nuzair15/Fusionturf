import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Award } from "@/types";
import { Medal, Trophy, Users, Clock, Vote, ChevronLeft } from "lucide-react";
import { formatDate } from "@/lib/utils";

export function AwardsPage() {
  const navigate = useNavigate();
  const { data: awards } = useQuery({
    queryKey: ["awards"],
    queryFn: () => api.get<Award[]>("/league/awards"),
  });

  const list = awards || [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Button variant="ghost" onClick={() => navigate("/league")} className="mb-4 gap-1">
          <ChevronLeft className="h-4 w-4" /> Back to League
        </Button>
        <h1 className="mb-2 text-3xl font-bold">Awards</h1>
        <p className="mb-8 text-muted-foreground">Season awards and recognition</p>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((award) => (
            <Card key={award.id} className="overflow-hidden transition-all hover:shadow-md">
              <div className="bg-gradient-to-r from-yellow-500/20 to-amber-500/20 p-6 text-center">
                <Medal className="mx-auto h-12 w-12 text-yellow-500" />
                <h3 className="mt-3 text-lg font-bold">{award.name}</h3>
                {award.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{award.description}</p>
                )}
              </div>
              <CardContent className="p-4">
                {award.winner ? (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Winner</p>
                    <p className="font-semibold">{award.winner.firstName} {award.winner.lastName}</p>
                  </div>
                ) : award.votingEnabled ? (
                  <div className="text-center">
                    <Badge variant="secondary" className="mb-2">
                      <Vote className="mr-1 h-3 w-3" /> Voting Open
                    </Badge>
                    {award.votingEndDate && (
                      <p className="text-xs text-muted-foreground">
                        Ends {formatDate(award.votingEndDate)}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-center text-sm text-muted-foreground">TBD</p>
                )}

                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{award._count?.nominations || 0} Nominations</span>
                  <span>{award._count?.votes || 0} Votes</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Previous Winners Section */}
        {list.some((a) => a.previousWinners && a.previousWinners.length > 0) && (
          <div className="mt-12">
            <h2 className="mb-6 text-2xl font-bold">Previous Winners</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.filter((a) => a.previousWinners && a.previousWinners.length > 0).slice(0, 3).map((award) => (
                award.previousWinners?.slice(0, 3).map((pw) => (
                  <Card key={pw.id}>
                    <CardContent className="flex items-center gap-3 p-4">
                      <Trophy className="h-8 w-8 text-yellow-500" />
                      <div>
                        <p className="text-sm font-medium">{pw.player.firstName} {pw.player.lastName}</p>
                        <p className="text-xs text-muted-foreground">{award.name} • {pw.season.name}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
