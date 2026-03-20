# Product Journey — Founder Morning Brief

## The Original Thesis

The founder should understand the full day in under 10 seconds.

Pushkar started every morning manually reconstructing his operating picture from Gmail, Google Calendar, notes, open tabs, and mental memory. That assembly work is cognitively expensive, happens before any real work begins, and is inconsistent — things get dropped.

The hypothesis: build a single surface where the day already exists when the laptop opens.

---

## How the Brain Processes a Workday

The UI structure was designed to mirror the cognitive order of how humans think about their day:

| Order | Question | Section |
|-------|----------|---------|
| 1 | What must I do today? | Priorities |
| 2 | What meetings are happening? | Meetings |
| 3 | What needs replies? | Unread emails |
| 4 | What risks/deadlines exist? | Watchouts |
| 5 | What am I focusing on? | Intention |

This ordering isn't arbitrary — it follows the natural priority cascade of a founder's brain at 8 AM. You think about obligations first, then time commitments, then communication debt, then risk, then intention-setting.

---

## V1: The Dashboard

Built during an internal hackathon sprint. A single-page React dashboard deployed on Vercel with:

- **Priorities** — manual entry with check-off, yesterday's unchecked items carry forward
- **Meetings** — pulled live from Google Calendar API, next meeting highlighted with a blue glow
- **Unread Emails** — fetched from Gmail API, 5 shown by default with "show all" expansion
- **Watchouts** — manual daily bullet list for risks and deadlines

Dark minimal design (pure black background, blue accent glow, Inter typeface). No AI, no filtering heuristics, no navigation. One page, one purpose.

Tech: React + Vite + TypeScript frontend, Vercel serverless API routes, MongoDB Atlas for persistence, Google OAuth 2.0 for Calendar and Gmail access.

The dashboard worked. It answered the question. But it required Pushkar to *open* something and *look* at it.

---

## The Pivot: From Dashboard to Morning Brief Email

After initial reviews and further thinking, a realization: the highest-value version of this product doesn't require the user to do anything at all.

Instead of Pushkar opening a dashboard, the product should **come to him**. Every morning, an email lands in his inbox with his day already synthesized — priorities extracted from his calendar and emails, meetings organized by importance, all powered by AI.

### What changed

| Aspect | V1 (Dashboard) | V2 (Morning Brief Email) |
|--------|----------------|--------------------------|
| Delivery | User opens the app | Email arrives automatically |
| AI | None | Gemini 2.0 Flash analyzes calendar + emails |
| Priorities | Manual entry | AI-generated from real data |
| Meeting highlighting | Next upcoming (time-based) | Key meetings (importance-based) |
| User effort | Open app, read sections | Open inbox, read one email |
| Trigger | On-demand | Vercel cron job, daily at 6:00 AM IST |

### How it works now

1. A Vercel cron job fires daily at 6:00 AM IST
2. The server fetches Pushkar's calendar events and unread emails via Google APIs
3. Gemini 2.0 Flash analyzes both and produces: AI-generated priorities, a day summary, and key meeting identification
4. A styled HTML email is built and sent to Pushkar via the Gmail API
5. If Gemini fails, a fallback email with just the schedule and inbox count is sent instead
6. Deduplication prevents double-sends; a `?force=true` param can override

The dashboard still exists and is functional, but the email is now the primary product surface.

---

## Auth Hardening

Since the app uses Pushkar's Google OAuth tokens to read his calendar/email and send on his behalf, token security is critical. The auth flow was hardened to ensure:

- Only `pushkar@lemnisca.bio` can authenticate (enforced via `ALLOWED_EMAIL` env var)
- The `googleEmail` field in MongoDB locks the account on first auth
- Any other Google account attempting OAuth is rejected before any DB write occurs

---

## What's Next

- **A/B testing email formats** — experimenting with different layouts, lengths, and tones to find what Pushkar actually prefers opening each morning
- **Integration with other sprint apps** — Aryan and Vishesh are building complementary tools in the same sprint; features from those apps will layer into the morning brief over time
- **Smarter email filtering** — beyond `is:unread`, heuristics like starred, awaiting reply, VIP senders
