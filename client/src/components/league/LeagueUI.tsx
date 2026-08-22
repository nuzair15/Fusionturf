import { ReactNode } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

export function LeagueHero({
  title,
  subtitle,
  image,
  eyebrow,
  actions,
  stats,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  image?: string;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  stats?: Array<{ label: string; value: ReactNode; tone?: string }>;
}) {
  const optimizedHero = image === "/hero-1440.webp";
  return (
    <section className="relative overflow-hidden rounded-2xl border bg-card shadow-sm">
      {image && (
        <>
          <div className="absolute inset-0">
            {optimizedHero ? <picture>
              <source type="image/avif" srcSet="/hero-640.avif 640w, /hero-960.avif 960w, /hero-1440.avif 1440w, /hero-1920.avif 1920w" sizes="(max-width: 1280px) 100vw, 1280px" />
              <source type="image/webp" srcSet="/hero-640.webp 640w, /hero-960.webp 960w, /hero-1440.webp 1440w, /hero-1920.webp 1920w" sizes="(max-width: 1280px) 100vw, 1280px" />
              <img src="/hero-1440.webp" alt="" width={1440} height={1080} fetchPriority="high" className="h-full w-full object-cover" />
            </picture> : <img src={image} alt="" width={1440} height={900} fetchPriority="high" className="h-full w-full object-cover" />}
          </div>
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(6,14,32,0.82),rgba(10,24,56,0.55),rgba(0,214,111,0.24))]" />
        </>
      )}
      <div className={cn("relative p-6 sm:p-8 lg:p-10", image ? "text-white" : "")}>
        {eyebrow && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide">
            {eyebrow}
          </div>
        )}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)] lg:items-end">
          <div>
            <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">{title}</h1>
            {subtitle && (
              <p className={cn("mt-4 max-w-2xl text-sm sm:text-base", image ? "text-white/78" : "text-muted-foreground")}>
                {subtitle}
              </p>
            )}
            {actions && <div className="mt-6 flex flex-wrap gap-3">{actions}</div>}
          </div>
          {stats && stats.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className={cn(
                    "rounded-xl border p-4 backdrop-blur",
                    image ? "border-white/15 bg-white/10 text-white" : "bg-background/70"
                  )}
                >
                  <p className={cn("text-xs uppercase tracking-wide", image ? "text-white/60" : "text-muted-foreground")}>{stat.label}</p>
                  <p className={cn("mt-1 text-2xl font-bold", stat.tone || "")}>{stat.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function LeaguePills({
  items,
  active,
  onChange,
}: {
  items: Array<{ key: string; label: string; icon?: ReactNode }>;
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto rounded-2xl border bg-card/80 p-2 shadow-sm">
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => onChange(item.key)}
          className={cn(
            "inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all",
            active === item.key
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function LeagueCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden shadow-sm">
      <div className="flex items-center justify-between border-b px-5 py-4 sm:px-6">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}

export function StatTile({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold", tone)}>{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

export function TrendBadge({ children }: { children: ReactNode }) {
  return (
    <Badge variant="secondary" className="gap-1 rounded-full px-2 py-1 text-[11px] uppercase tracking-wide">
      {children}
    </Badge>
  );
}

export function LeagueEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed bg-secondary/20 px-6 text-center">
      <p className="text-lg font-semibold">{title}</p>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SectionLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} className="gap-1">
      {children} <ChevronRight className="h-4 w-4" />
    </Button>
  );
}
