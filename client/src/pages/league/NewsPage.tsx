import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { News } from "@/types";
import { ChevronLeft } from "lucide-react";

export function NewsPage() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["news"],
    queryFn: () => api.get<{ data: News[] }>("/league/news", { limit: "50" }),
  });

  const list = data?.data || [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Button variant="ghost" onClick={() => navigate("/league")} className="mb-4 gap-1">
          <ChevronLeft className="h-4 w-4" /> Back to League
        </Button>
        <h1 className="mb-2 text-3xl font-bold">News</h1>
        <p className="mb-8 text-muted-foreground">Latest updates from Fusion League</p>

        <div className="space-y-6">
          {list.map((article) => (
            <Card key={article.id} className="overflow-hidden transition-all hover:shadow-md">
              <div className="grid sm:grid-cols-3">
                {article.imageUrl && (
                  <div className="sm:col-span-1">
                    <img src={article.imageUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                )}
                <div className={`p-6 ${article.imageUrl ? "sm:col-span-2" : "sm:col-span-3"}`}>
                  <p className="text-xs text-muted-foreground">
                    {article.publishedAt ? formatDate(article.publishedAt) : ""}
                    {article.author && ` • ${article.author}`}
                    {article.team && ` • ${article.team.name}`}
                  </p>
                  <h2 className="mt-1 text-xl font-bold">{article.title}</h2>
                  {article.excerpt && <p className="mt-2 text-muted-foreground">{article.excerpt}</p>}
                  {article.content && (
                    <div className="mt-4 text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: article.content }} />
                  )}
                </div>
              </div>
            </Card>
          ))}
          {list.length === 0 && (
            <p className="py-12 text-center text-muted-foreground">No news articles yet.</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
