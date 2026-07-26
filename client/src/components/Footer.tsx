import { Link } from "react-router-dom";

const footerLinks = {
  Platform: [
    { label: "Book Turf", to: "/booking" },
    { label: "League", to: "/league" },
    { label: "Standings", to: "/league/standings" },
    { label: "Statistics", to: "/league/stats" },
    { label: "Awards", to: "/league/awards" },
  ],
  Company: [
    { label: "About Us", to: "#" },
    { label: "Contact", to: "#" },
    { label: "Careers", to: "#" },
    { label: "Press Kit", to: "#" },
  ],
  Support: [
    { label: "Help Center", to: "#" },
    { label: "Terms of Service", to: "#" },
    { label: "Privacy Policy", to: "#" },
    { label: "Cookie Policy", to: "#" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo.svg" alt="Fusion League" className="h-8 w-auto" />
              <span className="text-lg font-bold">Fusion League</span>
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
          <Link
            to="/admin"
            className="mx-auto mb-4 flex w-fit items-center gap-2 rounded-lg border border-[#00d66f]/30 bg-[#00d66f]/10 px-4 py-2 text-sm font-medium text-[#00d66f] transition-colors hover:bg-[#00d66f]/20"
          >
            Admin Panel
          </Link>
          &copy; {new Date().getFullYear()} Fusion League. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
