# Fusion League 🏆⚽

A premium production-ready turf booking and football league management platform built with React 19, Node.js, Express, PostgreSQL, and Prisma.

## Tech Stack

**Frontend:** React 19, Vite, TypeScript, Tailwind CSS, Shadcn UI, Framer Motion, TanStack Query, React Router
**Backend:** Node.js, Express, TypeScript, Prisma ORM, PostgreSQL, JWT Auth
**Infrastructure:** Docker, Render (one-click deploy)

## Features

### Turf Booking
- Browse venues with facility details, gallery, and reviews
- Real-time slot availability with interactive calendar
- Dynamic pricing (weekday/weekend/peak hours)
- Coupon codes and discounts
- Booking history and management dashboard

### Fusion League
- Multiple seasons with team/player management
- Complete league standings with auto-calculated points
- Match management (scheduled, live, completed)
- Detailed match stats (possession, shots, cards, lineups, ratings)
- Player statistics (goals, assists, clean sheets, etc.)
- Awards system with configurable voting

### Admin Panel
- Role-based access control (Super Admin, League Admin, Booking Manager, etc.)
- Content management (news, gallery, sponsors)
- Users management
- Dashboard with analytics and revenue tracking

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 16+
- npm

### Local Development

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/fusion-league.git
cd fusion-league

# Install dependencies
npm install
cd server && npm install
cd ../client && npm install
cd ..

# Setup environment variables
cp server/.env.example server/.env
# Set DATABASE_URL, JWT_SECRET, and ADMIN_PANEL_PASSWORD in server/.env

# Setup database
cd server
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
cd ..

# Start development servers
npm run dev
```

### Admin access

Admin access is password-only. Set `ADMIN_PANEL_PASSWORD` in `server/.env`; no default production password is provided.

## Deploy to Render

### One-Click Deploy

1. Push this repository to GitHub
2. Log in to [Render](https://render.com)
3. Click "New +" → "Blueprint"
4. Connect your GitHub repository
5. Render will automatically detect the `render.yaml` file
6. Click "Apply" to deploy all services:
   - **fusion-league-api** - Express backend
   - **fusion-league-client** - React frontend (static site)
   - **fusion-league-db** - PostgreSQL database

### Manual Setup

If Blueprint doesn't work, create three resources manually:

**1. PostgreSQL Database**
- Create a new PostgreSQL database
- Copy the internal connection string

**2. Web Service (API)**
- Build command: `cd server && npm install && npx prisma generate && npm run build`
- Start command: `cd server && node dist/production.js`
- Environment variables:
  - `DATABASE_URL` (from database)
  - `JWT_SECRET` (generate a random string)
  - `CORS_ORIGIN` = your client URL
  - `FRONTEND_URL` = your client URL
  - `ADMIN_PANEL_PASSWORD` = strong admin password

**3. Static Site (Client)**
- Build command: `cd client && npm install && npm run build`
- Publish directory: `client/dist`
- Environment variables:
  - `VITE_API_URL` = your API URL + /api
- Add a rewrite rule: `/*` → `/index.html`

## Project Structure

```
fusion-league/
├── server/              # Backend API
│   ├── prisma/          # Database schema & migrations
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── src/
│       ├── config/      # Environment & database config
│       ├── controllers/ # Route handlers
│       ├── middleware/   # Auth, validation, error handling
│       ├── routes/      # Express routes
│       ├── services/    # Email, notifications
│       └── utils/       # Helpers, pagination
├── client/              # React frontend
│   └── src/
│       ├── components/  # Reusable UI components
│       ├── pages/       # Page components
│       ├── providers/   # Auth & theme context
│       ├── lib/         # API client & utilities
│       └── types/       # TypeScript types
├── docker-compose.yml
├── render.yaml
└── package.json
```

## API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user (auth required)

### Turf Booking
- `GET /api/bookings/venues` - List venues
- `GET /api/bookings/venues/:slug` - Venue details
- `GET /api/bookings/slots` - Available slots
- `POST /api/bookings` - Create booking (auth required)
- `GET /api/bookings/my` - User's bookings (auth required)

### League
- `GET /api/league/seasons` - List seasons
- `GET /api/league/seasons/current` - Current season
- `GET /api/league/teams` - List teams
- `GET /api/league/teams/:slug` - Team details
- `GET /api/league/players` - List players
- `GET /api/league/players/:slug` - Player details
- `GET /api/league/fixtures` - List fixtures
- `GET /api/league/fixtures/:id` - Fixture details
- `GET /api/league/standings` - League standings
- `GET /api/league/stats/top-scorers` - Top scorers
- `GET /api/league/awards` - List awards

### Admin (auth + admin role required)
- `GET /api/admin/dashboard` - Dashboard stats
- `GET /api/admin/users` - List users
- `POST /api/admin/seasons` - Create season
- `POST /api/admin/teams` - Create team
- `POST /api/admin/fixtures` - Create fixture
- `POST /api/admin/awards` - Create award

## License

MIT
