# CLAUDE.md — Founder Morning Brief

This file gives any AI coding assistant full context to work on this app correctly without repeated explanation. Read this before writing any code.

---

## What this product is

An automated morning brief email that gives a startup founder his entire day before he even opens an app. A Vercel cron job runs daily at 6:00 AM IST, reads Pushkar's Google Calendar and Gmail, sends both to Gemini 2.0 Flash for analysis, and delivers a styled HTML email with AI-generated priorities, a day summary, and a tiered meeting schedule.

**Primary user:** Pushkar (single-user app — `pushkar@lemnisca.bio`)
**Primary surface:** Morning brief email (sent via Gmail API)
**Secondary surface:** Dashboard (React SPA — still functional, used for OAuth entry and manual reference)
**Deployed at:** Vercel (React + serverless API routes + cron)
**AI:** Gemini 2.0 Flash — used exclusively in the morning brief cron for generating priorities and day summaries. No AI in the dashboard.

### How it evolved

Started as a dashboard-only app during an internal hackathon. After initial reviews, the core value shifted: instead of the user opening an app, the product comes to them. The morning brief email is now the primary delivery mechanism. The dashboard remains functional but secondary.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React (Vite) + TypeScript |
| Styling | Plain CSS with custom properties — no Tailwind, no CSS-in-JS |
| Backend | Vercel serverless API routes (`/api/*`) |
| Database | MongoDB Atlas (Mongoose ODM) |
| Auth | Google OAuth 2.0 (Calendar + Gmail read/send + profile) |
| AI | Gemini 2.0 Flash (cron job only) |
| Email delivery | Gmail API (sends as Pushkar) |
| Scheduling | Vercel Cron (daily 6:00 AM IST) |
| Fonts | Inter (dashboard), DM Sans + Playfair Display (email) |

---

## Project structure

```
/
├── src/                              # React dashboard (secondary surface)
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── PrioritiesSection.tsx
│   │   ├── MeetingsSection.tsx
│   │   ├── EmailSection.tsx
│   │   ├── WatchoutsSection.tsx
│   │   ├── IntentionSection.tsx
│   │   └── SkeletonCard.tsx
│   ├── lib/
│   │   ├── api.ts
│   │   └── dateUtils.ts
│   └── styles/
│       ├── globals.css
│       └── components.css
├── api/                              # Vercel serverless routes
│   ├── auth/
│   │   ├── google.ts                 # OAuth redirect initiation
│   │   ├── callback.ts              # OAuth callback — ALLOWED_EMAIL gate, stores tokens
│   │   └── logout.ts                # Session logout
│   ├── cron/
│   │   └── morning-brief.ts         # THE CORE — daily email cron job
│   ├── _lib/
│   │   ├── db.ts                    # MongoDB connection
│   │   ├── google.ts                # OAuth2 client, token refresh, scopes
│   │   ├── gemini.ts                # Gemini 2.0 Flash prompt + parsing
│   │   ├── email-template.ts        # HTML email builder (full + fallback)
│   │   ├── models.ts                # Mongoose schemas
│   │   ├── session.ts               # Cookie session utils
│   │   └── time.ts                  # IST time formatting
│   ├── calendar.ts                  # Google Calendar API (dashboard)
│   ├── emails.ts                    # Gmail API unread (dashboard)
│   ├── me.ts                        # Session/profile check
│   ├── priorities.ts                # CRUD (dashboard)
│   ├── watchouts.ts                 # CRUD (dashboard)
│   └── intention.ts                 # CRUD (dashboard)
├── vercel.json                       # Cron schedule + route rewrites
├── .env.example                      # Mock env vars (never real secrets)
├── CLAUDE.md                         # This file
├── PRODUCT-JOURNEY.md               # Product evolution narrative
├── PRD.md                           # Product requirements
├── package.json
└── vite.config.ts
```

---

## Environment variables

```bash
# .env.local — all required, never commit real values

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=            # localhost for dev, production URL for Vercel

MONGODB_URI=                     # MongoDB Atlas connection string

SESSION_SECRET=                  # random string for signing cookies

GEMINI_API_KEY=                  # Google AI Studio key for Gemini 2.0 Flash

CRON_SECRET=                     # Bearer token to protect the cron endpoint
BRIEF_TO_EMAIL=                  # Recipient email for the morning brief

ALLOWED_EMAIL=                   # The only Google account allowed to OAuth (pushkar@lemnisca.bio)
```

Never expose any of these to the browser. All API calls go through `/api/*` routes.

---

## Morning Brief Email — The Core Feature

### Flow

1. Vercel cron fires at `30 0 * * *` UTC (6:00 AM IST)
2. `api/cron/morning-brief.ts` authenticates via `CRON_SECRET` Bearer token
3. Fetches today's calendar events + unread emails (up to 20) from Google APIs
4. Sends both to Gemini 2.0 Flash with a structured prompt
5. Gemini returns JSON: `{ priorities[], daySummary, keyMeetingIndices[] }`
6. HTML email is built via `email-template.ts` and sent via Gmail API
7. Success logged to `BriefLog` collection for deduplication

### Gemini prompt structure

- System: "You are a concise executive assistant. Analyze today's calendar and unread emails for a startup founder."
- User: calendar events + email metadata + strict JSON output format
- Rules: 3-6 priorities (verb-led, from real data only), day summary, key meeting indices
- Temperature: 0.3, max tokens: 2048

### Email template

- Two versions: full (with Gemini analysis) and fallback (schedule + inbox count only)
- Fonts: Playfair Display (headings), DM Sans (body)
- Key meetings: blue accent border. Routine: gray border
- Join buttons for meetings with video links

### Special params

- `?preview=true` — returns HTML without sending (for testing)
- `?force=true` — bypasses deduplication (re-sends even if already sent today)

---

## Auth & Security

### OAuth flow

1. User hits `/api/auth/google` → redirected to Google with scopes
2. Google redirects to `/api/auth/callback?code=...`
3. **Hard gate:** callback checks `email !== process.env.ALLOWED_EMAIL` → rejects before any DB write
4. On success: tokens stored in MongoDB, session cookie set
5. All `/api/calendar`, `/api/emails` calls use stored tokens with auto-refresh

### Scopes

```
calendar.readonly
gmail.readonly
gmail.send
userinfo.profile
```

### Token refresh

If Google API returns 401, the server uses `refresh_token` to get a new `access_token`, updates MongoDB, retries once.

---

## Dashboard — Design System (Secondary Surface)

```css
:root {
  --bg-page: #000000;
  --bg-card: rgba(255, 255, 255, 0.04);
  --bg-card-hover: rgba(255, 255, 255, 0.06);
  --border-default: rgba(255, 255, 255, 0.10);
  --border-accent: rgba(0, 120, 255, 0.30);
  --text-primary: rgba(255, 255, 255, 0.87);
  --text-secondary: rgba(255, 255, 255, 0.55);
  --text-muted: rgba(255, 255, 255, 0.25);
  --accent: #1a8aff;
  --accent-dark: #0066ee;
  --accent-glow-sm: 0 0 15px 2px rgba(0, 100, 255, 0.5), 0 0 40px 8px rgba(0, 80, 255, 0.25);
  --font: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --radius-card: 16px;
  --radius-input: 100px;
}
```

**Typography:** Weights 300/400/500 only. Section labels: 0.65rem uppercase muted. Body: 0.85rem secondary. Blue glow only on the next upcoming meeting card and focused inputs.

**Layout:** Desktop 2-column grid. Mobile (< 768px) single column. Cognitive order: Priorities → Meetings → Emails → Watchouts → Intention.

---

## MongoDB schemas

```typescript
// GoogleToken — OAuth credentials (single-user)
{ userId, displayName, googleEmail, accessToken, refreshToken, expiresAt }

// BriefLog — deduplication for morning brief cron
{ userId, date (YYYY-MM-DD), sentAt }

// Priority — dashboard manual entries
{ userId, date, text, done, carriedOver, createdAt }

// Watchout — dashboard manual entries
{ userId, date, text, createdAt }

// Intention — dashboard manual entries
{ userId, date, text, updatedAt }
```

---

## API routes

```
# Morning brief (the core)
GET  /api/cron/morning-brief        → sends email (requires CRON_SECRET Bearer token)

# Auth
GET  /api/auth/google               → initiates OAuth redirect
GET  /api/auth/callback             → handles OAuth callback (ALLOWED_EMAIL gate)
POST /api/auth/logout               → clears session

# Google data (dashboard)
GET  /api/calendar                  → CalendarEvent[]
GET  /api/emails                    → EmailItem[] (up to 20)
GET  /api/me                        → session/profile check

# Dashboard CRUD
GET/POST/PATCH/DELETE /api/priorities
GET/POST/DELETE       /api/watchouts
GET/PUT               /api/intention
```

---

## What NOT to do

- Do not add AI to the dashboard frontend — Gemini is only in the cron job
- Do not expose secrets to the browser
- Do not allow anyone other than `pushkar@lemnisca.bio` to authenticate
- Do not use Tailwind — plain CSS with design tokens
- Do not use Notion — MongoDB only
- Do not add navigation, tabs, or multiple pages to the dashboard
- Do not carry over watchouts between days (only priorities carry over)
- Do not add email filtering beyond `is:unread` yet
