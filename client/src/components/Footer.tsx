import { Link } from "react-router-dom";

const footerLinks = {
  Explore: [
    { label: "Book Turf", to: "/booking" },
    { label: "League", to: "/league" },
    { label: "Fixtures", to: "/league/fixtures" },
    { label: "Standings", to: "/league/standings" },
    { label: "Statistics", to: "/league/stats" },
    { label: "Awards", to: "/league/awards" },
  ],
  Account: [
    { label: "My account", to: "/dashboard" },
    { label: "Manage booking", to: "/booking/manage" },
    { label: "Sign in", to: "/auth" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="Fusion Turf" fetchPriority="high" className="h-8 w-auto" />
              <span className="text-lg font-bold">Fusion Turf</span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              Premium turf booking and football league management platform. Play, compete, and conquer.
            </p>
          </div>
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="mb-3 text-sm font-semibold">{title}</h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Fusion Turf. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
