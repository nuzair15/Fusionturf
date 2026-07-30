import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { Moon, Sun, Calendar } from "lucide-react";

export function Navbar() {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<Record<string, string>>("/settings"),
    retry: false,
  });

  const siteLogoUrl = settings?.site_logo_url;
  const siteName = settings?.site_name || "Fusion Turf";

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background">
      <div className="mx-auto flex h-16 items-center justify-between px-4 sm:px-6 md:h-20">
        <Link to="/" className="flex items-center gap-3">
          {siteLogoUrl ? (
            <img src={siteLogoUrl} alt={siteName} fetchPriority="high" className="h-9 w-auto max-w-[140px] object-contain md:h-10 md:max-w-[160px]" />
          ) : (
            <img src="/logo.png" alt={siteName} fetchPriority="high" className="h-9 w-auto object-contain md:h-10" />
          )}
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <Link to="/league" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            League
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => navigate("/booking")} size="sm" className="gap-1.5">
            <Calendar className="h-4 w-4" /> Book Now
          </Button>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent md:h-10 md:w-10"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </nav>
  );
}
