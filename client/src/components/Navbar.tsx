import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/providers/ThemeProvider";
import { api } from "@/lib/api";
import { Moon, Sun, LogOut } from "lucide-react";

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
            <img src={siteLogoUrl} alt={siteName} className="h-9 w-auto max-w-[140px] object-contain md:h-10 md:max-w-[160px]" />
          ) : (
            <>
              <img src="/logo.png" alt={siteName} className="h-9 w-auto object-contain md:h-10" />
              <span className="text-lg font-bold md:text-xl">{siteName}</span>
            </>
          )}
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {[
            { to: "/", label: "Home" },
            { to: "/booking", label: "Book Turf" },
            { to: "/league", label: "League" },
            { to: "/admin", label: "Admin" },
          ].map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent md:h-10 md:w-10"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </nav>
  );
}
