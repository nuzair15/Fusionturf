import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { Home, Calendar, Trophy, Settings } from "lucide-react";

const links = [
  { to: "/", label: "Home", icon: Home },
  { to: "/booking", label: "Book", icon: Calendar },
  { to: "/league", label: "League", icon: Trophy },
];

export function BottomNav() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const isAdmin = user && ["SUPER_ADMIN", "LEAGUE_ADMIN", "BOOKING_MANAGER"].includes(user.role);

  if (pathname.startsWith("/admin")) return null;

  const visible = isAdmin ? [...links, { to: "/admin", label: "Admin", icon: Settings }] : links;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
      <div className="flex items-center justify-around">
        {visible.map((link) => {
          const active = pathname === link.to || (link.to !== "/" && pathname.startsWith(link.to));
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors w-full ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <link.icon className="h-5 w-5" />
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
