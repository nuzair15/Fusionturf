import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
  build: {
    // No production build should ship debug info: sourcemaps are large
    // (often bigger than the code they map) and only useful to you
    // locally, not to a browser loading the site.
    sourcemap: false,
    rollupOptions: {
      output: {
        // Routes are already code-split with React.lazy() in App.tsx, so
        // each page only loads its own chunk. This further splits out the
        // big third-party libraries that are shared across many of those
        // pages into their own vendor chunks -- instead of duplicating
        // (say) recharts or date-fns into every page chunk that imports
        // them, the browser fetches each vendor chunk once and caches it
        // across navigations, and it stays cached across deploys as long
        // as that library's version doesn't change.
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-radix": [
            "@radix-ui/react-accordion",
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-avatar",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-label",
            "@radix-ui/react-popover",
            "@radix-ui/react-progress",
            "@radix-ui/react-radio-group",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-select",
            "@radix-ui/react-separator",
            "@radix-ui/react-slider",
            "@radix-ui/react-slot",
            "@radix-ui/react-switch",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-toggle",
            "@radix-ui/react-toggle-group",
            "@radix-ui/react-tooltip",
          ],
          "vendor-charts": ["recharts"],
          "vendor-calendar": [
            "@fullcalendar/core",
            "@fullcalendar/daygrid",
            "@fullcalendar/interaction",
            "@fullcalendar/react",
            "@fullcalendar/timegrid",
          ],
          "vendor-motion": ["framer-motion"],
          "vendor-query": ["@tanstack/react-query", "@tanstack/react-table"],
        },
      },
    },
  },
  esbuild: {
    // Strip console.* and debugger statements from the production bundle
    // only -- during `vite dev` those statements are exactly what you want
    // to see. Dev-time logging left in a prod build otherwise ships to
    // every visitor's browser and keeps running there for no benefit.
    drop: command === "build" ? ["console", "debugger"] : [],
  },
}));
