# Founder Morning Brief

An automated morning brief email for startup founders. Every day at 6:00 AM IST, it reads your Google Calendar and Gmail, runs them through Gemini 2.0 Flash, and sends you a styled email with AI-generated priorities, a day summary, and your meeting schedule — tiered by importance.

Built for Pushkar at [Lemnisca](https://lemnisca.bio) during an internal hackathon sprint.

## How it works

1. Vercel cron fires daily at 6:00 AM IST
2. Fetches today's calendar events and unread emails via Google APIs
3. Gemini 2.0 Flash analyzes both and produces priorities, a day summary, and key meeting flags
4. A styled HTML email is built and sent via Gmail API
5. If Gemini fails, a fallback email with just the schedule and inbox count is sent

## Tech stack

- **Backend:** Vercel serverless API routes (TypeScript)
- **AI:** Gemini 2.0 Flash (structured summarization)
- **Email delivery:** Gmail API (sends from the user's own address)
- **Data:** Google Calendar API + Gmail API
- **Database:** MongoDB Atlas (OAuth tokens, dedup logs)
- **Scheduling:** Vercel Cron
- **Dashboard (secondary):** React (Vite) + plain CSS

## Local development

### Prerequisites

- Node.js 18+
- MongoDB Atlas cluster
- Google Cloud project with Calendar and Gmail APIs enabled
- OAuth 2.0 credentials (Web application type)
- Gemini API key from Google AI Studio

### Setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local` with your actual values:

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:5173/api/auth/callback
MONGODB_URI=mongodb+srv://...
SESSION_SECRET=any-random-string
GEMINI_API_KEY=
CRON_SECRET=any-random-string
BRIEF_TO_EMAIL=recipient@example.com
ALLOWED_EMAIL=authorized-google-account@example.com
```

### Run

```bash
npm run dev
```

Starts both the Express dev server (API routes) and Vite (frontend) concurrently.

### Test the morning brief locally

```bash
# Preview (returns HTML, doesn't send)
curl -H "Authorization: Bearer YOUR_CRON_SECRET" "http://localhost:5173/api/cron/morning-brief?preview=true"

# Force send (bypasses dedup)
curl -H "Authorization: Bearer YOUR_CRON_SECRET" "http://localhost:5173/api/cron/morning-brief?force=true"
```

## Deploy to Vercel

1. Push to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Add all environment variables (update `GOOGLE_REDIRECT_URI` to your production URL)
4. Deploy — the cron job is configured in `vercel.json`

## Project structure

```
api/
  cron/morning-brief.ts    — Daily email cron job (the core)
  _lib/
    gemini.ts              — Gemini 2.0 Flash prompt + response parsing
    email-template.ts      — HTML email builder (full + fallback)
    google.ts              — OAuth2 client, token refresh
    models.ts              — Mongoose schemas
    db.ts, session.ts, time.ts
  auth/                    — Google OAuth flow (locked to ALLOWED_EMAIL)
  calendar.ts, emails.ts   — Google API data routes (dashboard)
  priorities.ts, watchouts.ts, intention.ts — Dashboard CRUD
src/                       — React dashboard (secondary surface)
```
