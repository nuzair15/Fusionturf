import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Award } from "@/types";
import { Medal, Trophy, Vote, ChevronLeft } from "lucide-react";
import { formatDate } from "@/lib/utils";

export function AwardsPage() {
  const navigate = useNavigate();
  const { data: awards } = useQuery({
    queryKey: ["awards"],
    queryFn: () => api.get<Award[]>("/league/awards"),
  });

  const list = awards || [];

  const hasPreviousWinners = list.some((a) => a.previousWinners && a.previousWinners.length > 0);

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
              <div className="flex items-center justify-center bg-gradient-to-r from-yellow-500/20 to-amber-500/20 p-6">
                {award.trophyImageUrl ? (
                  <img src={award.trophyImageUrl} alt={award.name} className="h-24 w-24 rounded-full object-cover shadow-sm" />
                ) : (
                  <Medal className="h-16 w-16 text-yellow-500" />
                )}
              </div>
              <CardContent className="p-4 text-center">
                <h3 className="text-lg font-bold">{award.name}</h3>
                {award.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{award.description}</p>
                )}

                <div className="mt-4">
                  {award.winner ? (
                    <div>
                      <p className="text-xs text-muted-foreground">Winner</p>
                      {award.type === "TEAM" && award.winnerTeam ? (
                        <p className="font-semibold">{award.winnerTeam.name}</p>
                      ) : (
                        <p className="font-semibold">{award.winner.firstName} {award.winner.lastName}</p>
                      )}
                    </div>
                  ) : award.votingEnabled ? (
                    <div>
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
                    <p className="text-sm text-muted-foreground">TBD</p>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{award._count?.nominations || 0} Nominations</span>
                  <span>{award._count?.votes || 0} Votes</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {hasPreviousWinners && (
          <div className="mt-12">
            <h2 className="mb-6 text-2xl font-bold">Previous Winners</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((award) =>
                award.previousWinners?.slice(0, 3).map((pw) => (
                  <Card key={pw.id}>
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-500/20">
                        {award.type === "TEAM" ? (
                          pw.team?.logoUrl ? (
                            <img src={pw.team.logoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                          ) : <Trophy className="h-5 w-5 text-yellow-500" />
                        ) : pw.player?.photoUrl ? (
                          <img src={pw.player.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <Trophy className="h-5 w-5 text-yellow-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {award.type === "TEAM" ? pw.team?.name : `${pw.player?.firstName} ${pw.player?.lastName}`}
                        </p>
                        <p className="text-xs text-muted-foreground">{award.name} &bull; {pw.season?.name}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}

        {list.length === 0 && (
          <div className="py-20 text-center">
            <Medal className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 text-xl font-bold">No Awards Yet</h2>
            <p className="mt-2 text-muted-foreground">Awards will appear here once created for the season.</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
