import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/providers/AuthProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ScrollToTop } from "@/components/ScrollToTop";
import { BottomNav } from "@/components/BottomNav";
import { HomePage } from "@/pages/home/HomePage";
import { BookingPage } from "@/pages/booking/BookingPage";
import { VenueDetailPage } from "@/pages/booking/VenueDetailPage";
import { LeaguePage } from "@/pages/league/LeaguePage";
import { FixturesPage } from "@/pages/league/FixturesPage";
import { TeamDetailPage } from "@/pages/league/TeamDetailPage";
import { PlayerDetailPage } from "@/pages/league/PlayerDetailPage";
import { FixtureDetailPage } from "@/pages/league/FixtureDetailPage";
import { StandingsPage } from "@/pages/league/StandingsPage";
import { StatsPage } from "@/pages/league/StatsPage";
import { AwardsPage } from "@/pages/league/AwardsPage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { AdminPage } from "@/pages/admin/AdminPage";
import { NewsPage } from "@/pages/league/NewsPage";

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
            <ScrollToTop />
            <div className="flex min-h-screen flex-col pb-16 md:pb-0">
              <Navbar />
              <main className="flex-1">
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
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/admin/*" element={<AdminPage />} />
                </Routes>
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
