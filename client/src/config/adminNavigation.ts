import {
  Activity, BarChart3, Calendar, CalendarDays, CircleHelp, GitCompare,
  Handshake, Image, LayoutDashboard, MapPin, Medal, MessageSquare,
  Monitor, Newspaper, Shield, Settings, Ticket, Trophy, Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface AdminNavItem { id: string; label: string; icon: LucideIcon }
export interface AdminNavGroup { label?: string; items: AdminNavItem[] }

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  { items: [{ id: "overview", label: "Dashboard", icon: LayoutDashboard }] },
  { label: "Operations", items: [
    { id: "bookings", label: "Bookings", icon: Calendar },
    { id: "calendar", label: "Calendar", icon: CalendarDays },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
  ] },
  { label: "Football", items: [
    { id: "seasons", label: "League", icon: Trophy },
    { id: "competitions", label: "Competitions", icon: Trophy },
    { id: "fixtures", label: "Fixtures", icon: Activity },
    { id: "teams", label: "Teams", icon: Users },
    { id: "players", label: "Players", icon: Users },
    { id: "player-stats", label: "Player Stats", icon: BarChart3 },
    { id: "awards", label: "Awards", icon: Medal },
    { id: "suspensions", label: "Suspensions", icon: Shield },
  ] },
  { label: "Content & business", items: [
    { id: "venues", label: "Venues", icon: MapPin },
    { id: "gallery", label: "Gallery", icon: Image },
    { id: "sponsors", label: "Sponsors", icon: Handshake },
    { id: "news", label: "News", icon: Newspaper },
    { id: "coupons", label: "Coupons", icon: Ticket },
    { id: "ads", label: "Ads", icon: Monitor },
    { id: "faqs", label: "FAQs", icon: CircleHelp },
    { id: "reviews", label: "Reviews", icon: MessageSquare },
  ] },
  { label: "System", items: [
    { id: "activity", label: "Activity", icon: GitCompare },
    { id: "users", label: "Users", icon: Shield },
    { id: "settings", label: "Settings", icon: Settings },
    { id: "recycle-bin", label: "Recycle Bin", icon: Ticket },
  ] },
];

export const ADMIN_TABS = ADMIN_NAV_GROUPS.flatMap((group) => group.items);
export const ADMIN_ROLE_TABS: Record<string, string[]> = {
  SUPER_ADMIN: ADMIN_TABS.map((tab) => tab.id),
  LEAGUE_ADMIN: ["seasons", "competitions", "fixtures", "teams", "players", "player-stats", "awards", "suspensions", "recycle-bin", "gallery", "sponsors", "news"],
  BOOKING_MANAGER: ["overview", "bookings", "calendar", "analytics", "venues", "coupons", "reviews"],
  CONTENT_EDITOR: ["news", "gallery", "sponsors", "ads", "faqs"],
  STATISTICIAN: ["seasons", "fixtures", "teams", "players", "player-stats", "awards", "suspensions"],
  REFEREE: ["seasons", "fixtures", "teams", "players", "suspensions"],
  VIEWER: ["seasons", "fixtures", "teams", "players", "player-stats", "awards", "gallery", "sponsors", "news", "suspensions"],
};
