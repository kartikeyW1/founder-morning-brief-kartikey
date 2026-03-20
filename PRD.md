# PRD — Founder Morning Brief

**Version:** 2.0
**Sprint:** Internal Hackathon
**Status:** V1 shipped, iterating

---

## 1. Problem Statement

Pushkar starts every workday by manually reconstructing his operating picture from at least five scattered sources: Gmail, Google Calendar, personal notes, open browser tabs, and mental memory. This assembly work is cognitively expensive, happens before any real work begins, and is inconsistent — important follow-ups, deadlines, and context get dropped.

There is no single surface where the day already exists when he opens his laptop.

**Update from V1:** The dashboard solved this partially — it required Pushkar to open an app. The real solution is zero-effort: a morning brief email that arrives before he starts working.

---

## 2. Why Now

Founder workload and parallel workstreams are increasing. The manual reconstruction cost that was tolerable at lower load becomes a real drag at scale. A daily operating view removes a repeatable, solvable tax from the start of every day — and the integrations needed (Gmail API, Google Calendar API) are standard Google OAuth flows, making this buildable cleanly in a sprint.

AI summarization (Gemini 2.0 Flash) is now cheap, fast, and reliable enough to synthesize calendar + email data into actionable priorities without manual input.

---

## 3. Core Use Case

> Pushkar opens his inbox in the morning. A brief email is already there. In under 10 seconds he knows: what to focus on today, which meetings matter, and what his day looks like. He didn't open an app, didn't check a dashboard, didn't assemble anything. The day was already understood for him.

That is the entire use case. Everything in the product serves this and nothing else.

**Previous (V1):** Pushkar opens the app at the start of his morning and reads a dashboard.
**Current (V2):** Pushkar opens his inbox and the brief is waiting.

---

## 4. How It Works

### Morning Brief Email (Primary Product)

A Vercel cron job runs daily at 6:00 AM IST and:

1. Fetches today's calendar events from Google Calendar API
2. Fetches unread emails from Gmail API (up to 20)
3. Sends both to Gemini 2.0 Flash for analysis
4. Gemini returns: prioritized action items, a day summary, and key meeting identification
5. An HTML email is built and sent to Pushkar via Gmail API
6. If Gemini fails, a fallback email with schedule + inbox count is sent

### Email Content Structure

| Section | Source | Purpose |
|---------|--------|---------|
| Greeting + date | System | Orientation |
| Day summary | Gemini | 1-2 sentence overview of the day |
| Priorities | Gemini (from calendar + emails) | 3-6 actionable items, verb-led, most important first |
| Schedule | Google Calendar API | All meetings, key ones highlighted with blue accent |

### Key Meetings vs Routine

Gemini classifies meetings into two tiers:
- **Key meetings** (investor calls, board meetings, external parties, deadlines) — highlighted with blue accent
- **Routine** (standups, 1:1s) — shown below a separator, no accent

### Fallback Behavior

If Gemini API fails after 2 attempts:
- A simplified email is sent with just the schedule and unread count
- Subject line gets a `(lite)` suffix
- An error notification email is also sent to flag the failure

### Deduplication

- Each successful send is logged in MongoDB (`BriefLog` collection)
- Subsequent cron triggers on the same day are skipped
- `?force=true` query param bypasses deduplication
- `?preview=true` returns the HTML without sending

---

## 5. Dashboard (Secondary — Still Functional)

The original dashboard remains deployed and functional. It serves as a manual reference and the OAuth entry point.

| Position | Section | Source |
|----------|---------|--------|
| 1 | Priorities | Manual entry, MongoDB |
| 2 | Meetings | Google Calendar API |
| 3 | Unread Emails | Gmail API |
| 4 | Watchouts | Manual entry, MongoDB |
| 5 | Intention | Manual entry, MongoDB |

Design language: pure black background, blue accent glow, Inter typeface. Single page, fully responsive.

---

## 6. Auth & Security

- Google OAuth 2.0 for Calendar (read), Gmail (read + send), and user profile
- **Single-user lock:** Only `pushkar@lemnisca.bio` can authenticate, enforced via `ALLOWED_EMAIL` env var checked before any DB write
- `googleEmail` field in MongoDB locks the account on first auth as a secondary guard
- Cron endpoint protected by `CRON_SECRET` Bearer token
- All secrets server-side only — nothing exposed to the browser

---

## 7. Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | React (Vite) + TypeScript |
| Styling | Plain CSS with custom properties |
| Backend | Vercel serverless API routes |
| Database | MongoDB Atlas (Mongoose) |
| Auth | Google OAuth 2.0 |
| AI | Gemini 2.0 Flash (email cron only) |
| Email delivery | Gmail API (send as Pushkar) |
| Scheduling | Vercel Cron |
| Deployment | Vercel |

---

## 8. Non-Goals

- No AI in the dashboard frontend — Gemini is only used in the email cron
- No multi-user support
- No WhatsApp integration
- No Notion integration
- No notifications or push alerts beyond the morning email
- No historical analytics or reporting
- No email filtering beyond `is:unread` (future concern)
- No Tailwind — plain CSS only

---

## 9. Acceptance Criteria

### Morning Brief Email
- [x] Cron job fires daily and sends a styled HTML email to Pushkar
- [x] Email contains AI-generated priorities synthesized from calendar + emails
- [x] Key meetings are visually distinguished from routine meetings
- [x] Fallback email sends if Gemini fails
- [x] Deduplication prevents double-sends on the same day
- [x] Only `pushkar@lemnisca.bio` can authenticate — all others rejected

### Dashboard (maintained, not primary)
- [x] Calendar events load via Google Calendar API
- [x] Next upcoming meeting is highlighted
- [x] Unread emails load via Gmail API
- [x] Priorities support add, check-off, delete, and carry-over
- [x] Watchouts support add and delete
- [x] Intention saves and persists per day
- [x] Responsive layout (mobile + desktop)

---

## 10. Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary delivery | Email, not dashboard | Zero-effort consumption — it comes to you |
| AI model | Gemini 2.0 Flash | Fast, cheap, good enough for structured summarization |
| AI scope | Cron job only | Dashboard stays fast and dependency-free |
| Email sending | Gmail API (not SMTP) | Already have OAuth tokens, sends as Pushkar's own address |
| Auth lock | Env var + DB field | Belt and suspenders — env var is the hard gate, DB field is the fallback |
| Email template | Server-rendered HTML | Maximum email client compatibility |
| Deduplication | MongoDB log | Simple, reliable, overridable with `?force=true` |

---

## 11. What's Next

- **A/B testing email formats** — different layouts, lengths, tones to find what Pushkar prefers
- **Integration with other sprint apps** — Aryan and Vishesh are building complementary tools; features will layer into the brief
- **Smarter email filtering** — starred, awaiting reply, VIP senders
- **Feedback loop** — track if Pushkar opens/engages with the brief to inform iterations
