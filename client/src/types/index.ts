export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export type UserRole = "SUPER_ADMIN" | "LEAGUE_ADMIN" | "BOOKING_MANAGER" | "CONTENT_EDITOR" | "REFEREE" | "STATISTICIAN" | "VIEWER" | "CUSTOMER";

export interface Season {
  id: string;
  name: string;
  slug: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isCurrent: boolean;
  description?: string;
  transferWindowOpen?: boolean;
  transferWindowStartsAt?: string;
  transferWindowEndsAt?: string;
  _count?: { teams: number; players: number; fixtures: number };
}

export interface Team {
  id: string;
  seasonId: string;
  name: string;
  slug: string;
  shortName?: string;
  logoUrl?: string;
  coverUrl?: string;
  city?: string;
  foundedYear?: number;
  homeStadium?: string;
  description?: string;
  history?: string;
  achievements?: any;
  website?: string;
  socialLinks?: any;
  status?: string;
  isActive?: boolean;
  players?: Player[];
  staff?: Staff[];
  standings?: Standing[];
  homeMatches?: Fixture[];
  awayMatches?: Fixture[];
  sponsors?: Sponsor[];
  galleries?: Gallery[];
  news?: News[];
  _count?: { players: number; homeMatches: number };
}

export interface Player {
  id: string;
  seasonId: string;
  teamId?: string;
  team?: Team;
  firstName: string;
  lastName: string;
  slug: string;
  nationality?: string;
  dateOfBirth?: string;
  age?: number;
  height?: number;
  weight?: number;
  preferredFoot?: string;
  jerseyNumber?: number;
  position?: string;
  photoUrl?: string;
  biography?: string;
  squadType?: string;
  homeStats?: PlayerStat[];
  awards?: AwardWinner[];
  galleries?: Gallery[];
}

export interface PlayerStat {
  id: string;
  seasonId: string;
  playerId: string;
  teamId: string;
  appearances: number;
  goals: number;
  assists: number;
  minutesPlayed: number;
  passAccuracy?: number;
  shots: number;
  shotsOnTarget: number;
  tackles: number;
  interceptions: number;
  fouls: number;
  offsides: number;
  yellowCards: number;
  redCards: number;
  saves?: number;
  cleanSheets?: number;
  goalsConceded?: number;
  averageRating?: number;
  distanceCovered?: number;
  season?: Season;
  player?: { firstName: string; lastName: string; photoUrl?: string; position?: string };
  team?: { name: string; slug: string; logoUrl?: string };
}

export interface Staff {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  photoUrl?: string;
}

export interface Fixture {
  id: string;
  seasonId: string;
  competitionId?: string;
  homeTeamId: string;
  homeTeam: Team;
  awayTeamId: string;
  awayTeam: Team;
  venueId?: string;
  venue?: Venue;
  matchDate: string;
  kickoffTime?: string;
  round?: number;
  status: MatchStatus;
  homeScore?: number;
  awayScore?: number;
  homePossession?: number;
  awayPossession?: number;
  homeShots?: number;
  awayShots?: number;
  homeShotsOnTarget?: number;
  awayShotsOnTarget?: number;
  homeCorners?: number;
  awayCorners?: number;
  homeFouls?: number;
  awayFouls?: number;
  homeOffsides?: number;
  awayOffsides?: number;
  homeExpectedGoals?: number;
  awayExpectedGoals?: number;
  referee?: string;
  stadium?: string;
  attendance?: number;
  highlights?: string;
  manOfTheMatch?: Player;
  isFeatured?: boolean;
  goals?: Goal[];
  assists?: Assist[];
  cards?: Card[];
  substitutions?: Substitution[];
  lineups?: Lineup[];
  matchPlayerRatings?: MatchPlayerRating[];
  comments?: MatchComment[];
  galleries?: Gallery[];
  season?: Season;
  competition?: { name: string };
}

export type MatchStatus = "SCHEDULED" | "LIVE" | "POSTPONED" | "CANCELLED" | "COMPLETED";

export interface Goal {
  id: string;
  player: Player;
  minute: number;
  isOwnGoal: boolean;
  isPenalty: boolean;
}

export interface Assist {
  id: string;
  player: Player;
  minute: number;
}

export interface Card {
  id: string;
  player: Player;
  type: "YELLOW" | "RED" | "SECOND_YELLOW";
  minute: number;
}

export interface Substitution {
  id: string;
  playerOff: Player;
  playerOn: Player;
  minute: number;
}

export interface Lineup {
  id: string;
  player: Player;
  isStarter: boolean;
  position?: string;
  jerseyNumber?: number;
}

export interface MatchPlayerRating {
  id: string;
  player: { id: string; slug?: string; firstName: string; lastName: string };
  rating: number;
}

export interface MatchComment {
  id: string;
  user: { firstName: string; lastName: string; avatarUrl?: string };
  content: string;
  createdAt: string;
}

export interface Standing {
  id: string;
  seasonId: string;
  teamId: string;
  team: { name: string; slug: string; logoUrl?: string; shortName?: string };
  position: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form?: string;
}

export interface Venue {
  id: string;
  name: string;
  slug: string;
  description?: string;
  address: string;
  city: string;
  state: string;
  coverImage?: string;
  logo?: string;
  phone?: string;
  email?: string;
  latitude?: number;
  longitude?: number;
  openingTime: string;
  closingTime: string;
  turfs?: Turf[];
  gallery?: VenueGallery[];
  reviews?: Review[];
  workingHours?: VenueWorkingHour[];
  avgRating?: number | null;
  reviewCount?: number;
}

export interface Turf {
  id: string;
  venueId: string;
  name: string;
  description?: string;
  size?: string;
  surface?: string;
  basePrice: number;
  peakPrice: number;
  weekendPrice: number;
  capacity: number;
  imageUrl?: string;
  services?: AdditionalService[];
}

export interface AdditionalService {
  id: string;
  name: string;
  description?: string;
  price: number;
}

export interface SlotAvailability {
  id: string;
  turfId: string;
  date: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
  price: number;
}

export interface Booking {
  id: string;
  bookingNumber: string;
  userId: string;
  user?: { id: string; firstName: string; lastName: string; email: string; phone?: string };
  turfId: string;
  turf: Turf & { venue: { name: string; slug: string } };
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  numPlayers: number;
  totalAmount: number;
  discountAmount: number;
  couponCode?: string;
  status: BookingStatus;
  notes?: string;
  payments?: Payment[];
  services?: BookingService[];
}

export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "RESCHEDULED";

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method?: string;
  transactionId?: string;
}

export type PaymentStatus = "PENDING" | "PAID" | "REFUNDED" | "FAILED" | "PARTIALLY_REFUNDED";

export interface BookingService {
  id: string;
  additionalService: AdditionalService;
  quantity: number;
  price: number;
}

export interface VenueWorkingHour {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export interface VenueGallery {
  id: string;
  imageUrl: string;
  caption?: string;
}

export interface Review {
  id: string;
  userId: string;
  user: { firstName: string; lastName: string; avatarUrl?: string };
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface Award {
  id: string;
  seasonId: string;
  name: string;
  slug: string;
  description?: string;
  trophyImageUrl?: string;
  type: "PLAYER" | "TEAM";
  votingEnabled: boolean;
  votingType: AwardVotingType;
  voteFrequency: VoteFrequency;
  votingStartDate?: string;
  votingEndDate?: string;
  winner?: Player;
  winnerTeam?: { name: string; logoUrl?: string };
  winnerAnnounced: boolean;
  nominations?: AwardNomination[];
  previousWinners?: PreviousWinner[];
  _count?: { votes: number; nominations: number };
}

export type AwardVotingType = "PUBLIC" | "REGISTERED_ONLY" | "ADMIN_ONLY" | "DISABLED";
export type VoteFrequency = "ONCE" | "ONCE_PER_DAY" | "ONCE_PER_DEVICE" | "ONCE_PER_ACCOUNT" | "MULTIPLE";

export interface AwardNomination {
  id: string;
  player: Player & { team?: { name: string; logoUrl?: string } };
  reason?: string;
}

export interface PreviousWinner {
  id: string;
  player?: Player;
  team?: { name: string; logoUrl?: string };
  season: { name: string };
  year: string;
}

export interface AwardWinner {
  award: Award;
}

export interface Vote {
  id: string;
  nominee: { firstName: string; lastName: string; photoUrl?: string };
}

export interface News {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content?: string;
  imageUrl?: string;
  author?: string;
  isFeatured: boolean;
  publishedAt?: string;
  team?: { name: string; slug: string; logoUrl?: string };
}

export interface Gallery {
  id: string;
  title: string;
  imageUrl: string;
  videoUrl?: string;
  isActive?: boolean;
  createdAt?: string;
}

export interface Competition {
  id: string;
  seasonId: string;
  name: string;
  slug: string;
  type: "LEAGUE" | "KNOCKOUT" | "GROUP";
  isActive: boolean;
  createdAt: string;
  season?: Season;
  _count?: { fixtures: number };
}

export interface Sponsor {
  id: string;
  name: string;
  logoUrl: string;
  website?: string;
  tier?: string;
  isActive?: boolean;
  teamId?: string;
  team?: Team;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  maxUses?: number;
  usedCount?: number;
  minAmount?: number;
  expiresAt?: string;
  isActive?: boolean;
  createdAt?: string;
}

export interface Advertisement {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string;
  position?: string;
  isActive?: boolean;
  startsAt?: string;
  endsAt?: string;
  createdAt?: string;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category?: string;
  order?: number;
  isActive?: boolean;
  createdAt?: string;
}

export interface ReviewAdmin extends Review {
  isApproved: boolean;
  venue?: { name: string };
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  linkUrl?: string;
  createdAt: string;
}

export interface Suspension {
  id: string;
  playerId: string;
  seasonId: string;
  reason: string;
  matchBan: number;
  startDate: string;
  endDate: string;
  served: number;
  isActive: boolean;
  notes?: string;
  player?: { id: string; firstName: string; lastName: string; photoUrl?: string; jerseyNumber?: number; team?: { id: string; name: string; shortName?: string; logoUrl?: string } };
  season?: { id: string; name: string };
}

export interface ActivityLog {
  id: string;
  user?: { firstName: string; lastName: string };
  action: string;
  entity: string;
  entityId?: string;
  metadata?: any;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface TeamStat {
  id: string;
  seasonId: string;
  teamId: string;
  team: { name: string; slug: string; logoUrl?: string; shortName?: string };
  totalGoals: number;
  totalAssists: number;
  totalShots: number;
  totalCorners: number;
  totalFouls: number;
  totalOffsides: number;
  avgPossession?: number;
  cleanSheets: number;
}

export interface DashboardStats {
  stats: {
    totalUsers: number;
    totalBookings: number;
    totalTeams: number;
    totalPlayers: number;
    totalFixtures: number;
    totalRevenue: number;
    activeBookings: number;
  };
  recentFixtures: Fixture[];
}
