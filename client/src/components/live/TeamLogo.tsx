import { cn } from "@/lib/utils";

export function TeamLogo({ name, logoUrl, size = "md", className }: { name: string; logoUrl?: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-12 w-12 text-sm",
    lg: "h-16 w-16 text-lg sm:h-20 sm:w-20",
  };

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        className={cn("rounded-full bg-white/90 object-cover shadow-md ring-2 ring-white/40", sizes[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 font-black text-white shadow-md ring-2 ring-white/40",
        sizes[size],
        className
      )}
    >
      {initials || "?"}
    </div>
  );
}
