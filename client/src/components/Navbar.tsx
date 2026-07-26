import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { api } from "@/lib/api";
import { Menu, X, Moon, Sun, User, LogOut, Calendar, Trophy, Home, Settings } from "lucide-react";

const navLinks = [
  { to: "/", label: "Home", icon: Home },
  { to: "/booking", label: "Book Turf", icon: Calendar },
  { to: "/league", label: "League", icon: Trophy },
];

export function Navbar() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<Record<string, string>>("/settings"),
    retry: false,
  });

  const siteLogoUrl = settings?.site_logo_url;
  const siteName = settings?.site_name || "Fusion League";
  const isAdmin = user && ["SUPER_ADMIN", "LEAGUE_ADMIN", "BOOKING_MANAGER"].includes(user.role);

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-3">
          {siteLogoUrl ? (
            <img src={siteLogoUrl} alt={siteName} className="h-10 w-auto max-w-[160px] object-contain" />
          ) : (
            <>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#0a1838] to-[#00d66f]">
                <span className="text-base font-bold text-white">FL</span>
              </div>
              <span className="text-xl font-bold">{siteName}</span>
            </>
          )}
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
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
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          <div className="hidden items-center gap-2 md:flex">
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
                <Settings className="mr-2 h-4 w-4" /> Admin
              </Button>
            )}
            {user && (
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
                <User className="mr-2 h-4 w-4" /> {user.firstName}
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={logout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>

          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(!open)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t md:hidden"
          >
            <div className="space-y-1 px-4 py-4">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
                >
                  <link.icon className="h-4 w-4" /> {link.label}
                </Link>
              ))}
              <hr className="my-2" />
              {isAdmin && (
                <Link to="/admin" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent">
                  <Settings className="h-4 w-4" /> Admin
                </Link>
              )}
              {user && (
                <Link to="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent">
                  <User className="h-4 w-4" /> Dashboard
                </Link>
              )}
              <button onClick={() => { logout(); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-destructive hover:bg-accent">
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
