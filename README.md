# Founder Morning Brief

A single-page personal dashboard that shows a founder their entire day on open. Understand the full day in under 10 seconds — no navigation, no tabs, just information in the order the brain needs it.

## Sections

1. **Priorities** — manual entry with check-off and carry-over from yesterday
2. **Meetings** — read-only from Google Calendar, next meeting highlighted
3. **Unread Emails** — latest 20 from Gmail, 5 shown by default
4. **Watchouts** — daily bullet list, no carry-over
5. **Intention** — single free-text input, fresh each morning

## Tech stack

- **Frontend:** React (Vite) + TypeScript
- **Styling:** Plain CSS with custom properties
- **Backend:** Vercel serverless API routes (`/api/*`)
- **Database:** MongoDB Atlas (Mongoose)
- **Auth:** Google OAuth 2.0 (Calendar + Gmail scopes)

## Local development

### Prerequisites

- Node.js 18+
- A MongoDB Atlas cluster
- Google Cloud project with Calendar and Gmail APIs enabled
- OAuth 2.0 credentials (Web application type)

### Setup

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env.local
```

Fill in `.env.local`:

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:5173/api/auth/callback
MONGODB_URI=mongodb+srv://...
SESSION_SECRET=any-random-string
```

### Run

```bash
npm run dev
```

This starts both the Express dev server (API routes) and Vite (frontend) concurrently.

### Build

```bash
npm run build
```

## Deploy to Vercel

1. Push to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Add all environment variables from `.env.local` to the Vercel project settings (update `GOOGLE_REDIRECT_URI` to your production URL)
4. Deploy

The `vercel.json` rewrites are already configured — API routes go to `/api/*`, everything else serves the SPA.

## Project structure

```
src/           — React frontend (components, styles, utilities)
api/           — Vercel serverless API routes
server.ts      — Express dev server (proxies /api/* locally)
vercel.json    — Vercel routing config
```
