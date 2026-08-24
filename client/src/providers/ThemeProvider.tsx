import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "dark" | "light" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "dark" | "light";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // The old site always wrote "light" on first visit. Upgrade that legacy
    // default once while keeping any choice made after the dark launch.
    if (!localStorage.getItem("theme-default-v2")) {
      localStorage.setItem("theme-default-v2", "dark");
      return "dark";
    }
    return (localStorage.getItem("theme") as Theme) || "dark";
  });
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const root = document.documentElement;
    const isDark = theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : theme === "dark";

    setResolvedTheme(isDark ? "dark" : "light");
    root.classList.toggle("dark", isDark);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "system") {
        setResolvedTheme(mq.matches ? "dark" : "light");
        document.documentElement.classList.toggle("dark", mq.matches);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
