import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/providers/AuthProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { SEOHead } from "@/components/SEOHead";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ScrollToTop } from "@/components/ScrollToTop";
import { BottomNav } from "@/components/BottomNav";
const HomePage = lazy(() => import("@/pages/home/HomePage").then((m) => ({ default: m.HomePage })));
const BookingPage = lazy(() => import("@/pages/booking/BookingPage").then((m) => ({ default: m.BookingPage })));
const VenueDetailPage = lazy(() => import("@/pages/booking/VenueDetailPage").then((m) => ({ default: m.VenueDetailPage })));
const LeaguePage = lazy(() => import("@/pages/league/LeaguePage").then((m) => ({ default: m.LeaguePage })));
const FixturesPage = lazy(() => import("@/pages/league/FixturesPage").then((m) => ({ default: m.FixturesPage })));
const TeamDetailPage = lazy(() => import("@/pages/league/TeamDetailPage").then((m) => ({ default: m.TeamDetailPage })));
const PlayerDetailPage = lazy(() => import("@/pages/league/PlayerDetailPage").then((m) => ({ default: m.PlayerDetailPage })));
const FixtureDetailPage = lazy(() => import("@/pages/league/FixtureDetailPage").then((m) => ({ default: m.FixtureDetailPage })));
const StandingsPage = lazy(() => import("@/pages/league/StandingsPage").then((m) => ({ default: m.StandingsPage })));
const StatsPage = lazy(() => import("@/pages/league/StatsPage").then((m) => ({ default: m.StatsPage })));
const AwardsPage = lazy(() => import("@/pages/league/AwardsPage").then((m) => ({ default: m.AwardsPage })));
const DashboardPage = lazy(() => import("@/pages/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const AdminPage = lazy(() => import("@/pages/admin/AdminPage").then((m) => ({ default: m.AdminPage })));
const NewsPage = lazy(() => import("@/pages/league/NewsPage").then((m) => ({ default: m.NewsPage })));
const SearchPage = lazy(() => import("@/pages/search/SearchPage").then((m) => ({ default: m.SearchPage })));
import { ApiErrorNotice } from "@/components/ApiErrorNotice";
import { NotFoundPage } from "@/pages/NotFoundPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: 1 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <SEOHead />
            <ApiErrorNotice />
            <ScrollToTop />
            <div className="flex min-h-screen flex-col pb-16 md:pb-0">
              <Navbar />
              <main className="flex-1">
              <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">Loading…</div>}>
              <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/booking" element={<BookingPage />} />
                  <Route path="/booking/:slug" element={<VenueDetailPage />} />
                  <Route path="/league" element={<LeaguePage />} />
                  <Route path="/league/fixtures" element={<FixturesPage />} />
                  <Route path="/league/standings" element={<StandingsPage />} />
                  <Route path="/league/stats" element={<StatsPage />} />
                  <Route path="/league/awards" element={<AwardsPage />} />
                  <Route path="/league/news" element={<NewsPage />} />
                  <Route path="/league/teams/:slug" element={<TeamDetailPage />} />
                  <Route path="/league/players/:slug" element={<PlayerDetailPage />} />
                  <Route path="/league/fixtures/:id" element={<FixtureDetailPage />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/admin/*" element={<AdminPage />} />
                  <Route path="*" element={<NotFoundPage />} />
              </Routes>
              </Suspense>
              </main>
              <BottomNav />
              <Footer />
            </div>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
