# CLAUDE.md — Founder Morning Brief

This file gives any AI coding assistant (Claude Code, Cursor, Copilot) full context to build this app correctly without repeated explanation. Read this before writing any code.

---

## What this product is

A single-page personal dashboard that shows a founder their entire day on open. The goal: understand the full day in under 10 seconds. No navigation, no tabs, no onboarding — just information in the order the brain needs it.

**Primary user:** Pushkar (single-user app — no multi-tenant complexity)  
**Deployed at:** Vercel (React + serverless API routes)  
**AI in this app:** None. Zero. Do not add it.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React (Vite) + TypeScript |
| Styling | Plain CSS with custom properties — no Tailwind, no CSS-in-JS |
| Backend | Vercel serverless API routes (`/api/*`) |
| Database | MongoDB Atlas (Mongoose ODM) |
| Auth | Google OAuth 2.0 (for Calendar + Gmail access) |
| Fonts | Inter from Google Fonts |

---

## Project structure

```
/
├── src/
│   ├── main.tsx
│   ├── App.tsx                     # Root — date context, layout shell
│   ├── components/
│   │   ├── PrioritiesSection.tsx   # Manual entry, check-off, carry-over
│   │   ├── MeetingsSection.tsx     # Google Calendar — read only
│   │   ├── EmailSection.tsx        # Gmail API — unread emails only
│   │   ├── WatchoutsSection.tsx    # Manual bullet list, date-keyed
│   │   ├── IntentionSection.tsx    # Single text input, date-keyed
│   │   └── SkeletonCard.tsx        # Loading state placeholder
│   ├── lib/
│   │   ├── api.ts                  # fetch wrappers for all /api routes
│   │   └── dateUtils.ts            # getToday(), getYesterday() helpers
│   └── styles/
│       ├── globals.css             # Design tokens, resets
│       └── components.css          # Card, button, input shared styles
├── api/
│   ├── auth/
│   │   ├── google.ts               # OAuth redirect initiation
│   │   └── callback.ts             # OAuth callback — stores tokens in MongoDB
│   ├── calendar.ts                 # Fetches today's events from Google Calendar API
│   ├── emails.ts                   # Fetches unread emails from Gmail API
│   ├── priorities.ts               # GET + POST + PATCH + DELETE — MongoDB
│   ├── watchouts.ts                # GET + POST + DELETE — MongoDB
│   └── intention.ts                # GET + PUT — MongoDB
├── .env.local                      # Never commit this
├── CLAUDE.md                       # This file
├── package.json
└── vite.config.ts
```

---

## Environment variables

```bash
# .env.local — all required

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:5173/api/auth/callback   # update for prod

MONGODB_URI=mongodb+srv://...

SESSION_SECRET=any-random-string-for-signing-cookies
```

Never expose any of these to the browser. All API calls go through `/api/*` routes.

---

## Design system

Visual language derived from the Avira product (dark minimal, blue accent glow). Apply these tokens consistently — do not introduce new colors or font weights.

```css
:root {
  /* Backgrounds */
  --bg-page: #000000;
  --bg-card: rgba(255, 255, 255, 0.04);
  --bg-card-hover: rgba(255, 255, 255, 0.06);

  /* Borders */
  --border-default: rgba(255, 255, 255, 0.10);
  --border-accent: rgba(0, 120, 255, 0.30);

  /* Text */
  --text-primary: rgba(255, 255, 255, 0.87);
  --text-secondary: rgba(255, 255, 255, 0.55);
  --text-muted: rgba(255, 255, 255, 0.25);

  /* Accent — blue only */
  --accent: #1a8aff;
  --accent-dark: #0066ee;
  --accent-glow-sm: 0 0 15px 2px rgba(0, 100, 255, 0.5), 0 0 40px 8px rgba(0, 80, 255, 0.25);
  --accent-glow-lg: 0 0 20px 5px rgba(0, 100, 255, 0.7), 0 0 60px 15px rgba(0, 80, 255, 0.4);

  /* Typography */
  --font: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --radius-card: 16px;
  --radius-input: 100px;
  --radius-badge: 100px;
}
```

**Typography rules:**
- Weights: 300 (body), 400 (default), 500 (labels/emphasis) only — never 600 or 700
- Section labels: 0.65rem, weight 500, letter-spacing 0.12em, uppercase, `var(--text-muted)`
- Card titles / sender names: 0.9rem, weight 500, `var(--text-primary)`
- Body / list items / subjects: 0.85rem, weight 400, `var(--text-secondary)`
- Timestamps / meta: 0.75rem, weight 400, `var(--text-muted)`

**Glow usage — sparse:**
- Blue glow (`--accent-glow-sm`) only on: the next upcoming meeting card, focused inputs
- Nothing else gets the glow treatment

---

## Page layout — cognitive order (do not reorder)

```
┌─────────────────────────────────────────┐
│  Header: date + greeting                │
├─────────────────────────────────────────┤
│  1. PRIORITIES          (manual entry)  │
├─────────────────────────────────────────┤
│  2. MEETINGS            (Calendar API)  │
├─────────────────────────────────────────┤
│  3. UNREAD EMAILS       (Gmail API)     │
├─────────────────────────────────────────┤
│  4. WATCHOUTS           (manual entry)  │
├─────────────────────────────────────────┤
│  5. INTENTION           (single input)  │
└─────────────────────────────────────────┘
```

Desktop: 2-column grid — Priorities + Meetings side by side, Emails full width, Watchouts + Intention side by side.  
Mobile (< 768px): single column, same top-to-bottom order.

---

## Section specs

### 1. Priorities

- `GET /api/priorities?date=YYYY-MM-DD` returns today's items + yesterday's unchecked (flagged `carriedOver: true`)
- Carried-over items render at top with a small "from yesterday" badge in `--text-muted`
- Add: inline input at bottom of list, submit on Enter
- Check: `PATCH /api/priorities/:id` with `{ done: true }` — strike-through immediately (optimistic update)
- Delete: `DELETE /api/priorities/:id` — remove immediately (optimistic update)
- No item cap

### 2. Meetings

- `GET /api/calendar` — server fetches from Google Calendar API using stored OAuth token
- Returns: `{ id, time, endTime, title, location, meetLink, isNext }`
- `isNext: true` on the single next upcoming event (computed server-side from current UTC time)
- Render the `isNext` card with `--accent-glow-sm` box-shadow and `--border-accent` border
- If meetLink exists, render as a clickable "Join" button on the card
- Read only — no mutations

### 3. Unread emails

- `GET /api/emails` — server calls Gmail API with query `is:unread`, returns up to 20 results
- Returns: `{ id, sender, subject, receivedAt }`
- Default render: 5 most recent
- "Show all" button reveals the rest inline — no new page, no new API call (data already fetched)
- No AI. No scoring. No heuristics beyond `is:unread`. Future filtering goes here when ready.

### 4. Watchouts

- `GET /api/watchouts?date=YYYY-MM-DD`, `POST /api/watchouts`, `DELETE /api/watchouts/:id`
- Simple bullet list — no ordering, no carry-over between days
- Add: inline input, submit on Enter
- Delete: small × on hover

### 5. Intention

- `GET /api/intention?date=YYYY-MM-DD`, `PUT /api/intention`
- Single `<textarea>` — placeholder: "How are you going into today?"
- Auto-saves on blur, debounced 500ms
- No yesterday carry-over — fresh each morning

---

## MongoDB schemas

```typescript
// Priority
{
  userId: String,        // hardcoded for single-user MVP: 'pushkar'
  date: String,          // 'YYYY-MM-DD'
  text: String,
  done: Boolean,
  carriedOver: Boolean,
  createdAt: Date
}

// Watchout
{
  userId: String,
  date: String,
  text: String,
  createdAt: Date
}

// Intention
{
  userId: String,
  date: String,
  text: String,
  updatedAt: Date
}

// GoogleToken
{
  userId: String,
  accessToken: String,
  refreshToken: String,
  expiresAt: Date
}
```

---

## Google OAuth flow

1. User hits the app unauthenticated → redirect to `/api/auth/google`
2. `/api/auth/google` builds the Google OAuth URL with scopes:
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/gmail.readonly`
3. Google redirects to `/api/auth/callback?code=...`
4. Server exchanges code for `access_token` + `refresh_token`
5. Tokens stored in MongoDB `GoogleToken` collection against `userId: 'pushkar'`
6. Session cookie set (signed, httpOnly)
7. All subsequent `/api/calendar` and `/api/emails` calls retrieve the token from MongoDB

**Token refresh:** if Calendar or Gmail returns 401, use `refresh_token` to get a new `access_token`, update MongoDB, retry the call once.

---

## API route contracts

```
GET  /api/calendar                  → CalendarEvent[]
GET  /api/emails                    → EmailItem[]          (always fetches 20, client slices to 5)

GET  /api/priorities?date=          → Priority[]
POST /api/priorities                → Priority             body: { text }
PATCH /api/priorities/:id           → Priority             body: { done }
DELETE /api/priorities/:id          → { ok: true }

GET  /api/watchouts?date=           → Watchout[]
POST /api/watchouts                 → Watchout             body: { text, date }
DELETE /api/watchouts/:id           → { ok: true }

GET  /api/intention?date=           → Intention | null
PUT  /api/intention                 → Intention            body: { date, text }
```

All routes return JSON. Errors return `{ error: string }` with appropriate HTTP status.

---

## Build order (recommended)

1. Vercel scaffold + environment variables
2. MongoDB connection utility (`lib/db.ts`)
3. Google OAuth flow — get auth working end to end first, this unblocks everything else
4. `/api/calendar` + `MeetingsSection` — simplest read-only render, proves token flow
5. `/api/emails` + `EmailSection` — proves Gmail scope works, simple unread query
6. MongoDB schemas + `/api/priorities` CRUD + `PrioritiesSection` with carry-over logic
7. `/api/watchouts` + `WatchoutsSection`
8. `/api/intention` + `IntentionSection`
9. Styling pass — apply all design tokens, glow on next meeting, mobile layout
10. Deploy to Vercel, test on real device

---

## What NOT to do

- Do not add AI or Claude API anywhere — this version has zero AI
- Do not expose `GOOGLE_CLIENT_SECRET` or `MONGODB_URI` to the browser
- Do not use MCPs — they only exist inside Claude.ai and are unavailable in deployed apps
- Do not cap the number of priority items
- Do not carry over watchouts between days (only priorities carry over)
- Do not add navigation, tabs, or multiple pages
- Do not use Tailwind — plain CSS with the design tokens above
- Do not use Notion — MongoDB only
- Do not add any email filtering beyond `is:unread` — that is a future concern
