# PRD-lite — Founder Morning Brief
**Version:** 1.2  
**Sprint:** Internal Hackathon  
**Status:** Ready for build

---

## 1. Problem Statement

Pushkar starts every workday by manually reconstructing his operating picture from at least five scattered sources: Gmail, Google Calendar, personal notes, open browser tabs, and mental memory. This assembly work is cognitively expensive, happens before any real work begins, and is inconsistent — important follow-ups, deadlines, and context get dropped.

There is no single surface where the day already exists when he opens his laptop.

---

## 2. Why Now

Founder workload and parallel workstreams are increasing. The manual reconstruction cost that was tolerable at lower load becomes a real drag at scale. A daily operating view removes a repeatable, solvable tax from the start of every day — and the integrations needed (Gmail API, Google Calendar API) are standard Google OAuth flows, making this buildable cleanly in a sprint.

---

## 3. Core Use Case

> Pushkar opens the app at the start of his morning. In under 10 seconds he knows: what he must do today, what meetings are happening, which emails are unread, and what risks or deadlines he cannot drop. He adds or adjusts a few items and starts working.

That is the entire use case. Everything in the product serves this and nothing else.

---

## 4. UI / Cognitive Structure

The layout mirrors how the human brain processes a workday — top to bottom:

| Position | Section | Question it answers |
|---|---|---|
| 1 | **Top priorities** | What must I do today? |
| 2 | **Today's meetings** | What is happening and when? |
| 3 | **Unread emails** | What came in that I haven't seen? |
| 4 | **Watchouts** | What risks or deadlines exist? |
| 5 | **Focus intention** | What am I actually working on today? |

Design language: pure black background (`#000000`), card-based layout, blue (`#1a8aff → #0066ee`) accent with glow effects on highlighted elements, Inter typeface. Single page, no navigation, fully responsive (mobile + desktop).

---

## 5. MVP Scope

### Section 1 — Top priorities
- Manual entry, no cap on number of items
- Each item is checkable (mark done inline)
- Yesterday's unchecked items carry over at the top with a "from yesterday" badge
- Persisted to MongoDB

### Section 2 — Today's meetings
- Pulled live from Google Calendar API on page load
- Shows all events for the current day: time, title, location/meet link
- The single next upcoming meeting is visually highlighted — blue glow card
- Read only — no editing

### Section 3 — Unread emails
- Fetched from Gmail API via Google OAuth — unread messages only (`is:unread`)
- Shows: sender name, subject line, time received
- Default view: 5 most recent unread emails
- "Show all" expands the full unread list inline — no page navigation
- No AI, no scoring, no filtering beyond `is:unread`
- Future: additional heuristics (starred, awaiting reply, VIP senders) can layer in here

### Section 4 — Watchouts
- Manual bullet list: deadlines, risks, things not to drop
- Quick-add input, items deletable
- Persisted to MongoDB, date-keyed
- Does not carry over day to day

### Section 5 — Focus intention
- Single freeform text input: one sentence Pushkar writes about how he is entering the day
- Optional — shown empty each morning
- Persisted to MongoDB, date-keyed

---

## 6. Non-Goals

- No AI or smart filtering of any kind in this version
- No WhatsApp integration
- No team-wide task management or collaboration
- No Notion integration
- No notifications or push alerts
- No historical analytics or reporting
- No multi-user support in this sprint

---

## 7. Acceptance Criteria

The product ships when:

- [ ] Today's calendar events load via Google Calendar API on page open
- [ ] The next upcoming meeting is visually distinct (blue glow highlight)
- [ ] Unread emails load via Gmail API; default shows 5, "show all" expands inline
- [ ] Priorities support add, check-off, and delete with no item count cap
- [ ] Yesterday's unchecked priorities carry forward with a "from yesterday" indicator
- [ ] Watchouts support add and delete
- [ ] Focus intention saves and persists per day
- [ ] All manually entered data (priorities, watchouts, intention) persists in MongoDB
- [ ] Layout is fully usable on mobile (375px+) and desktop
- [ ] The entire day is understandable in under 10 seconds without scrolling on desktop
- [ ] App is deployed and demo-able on a live URL

---

## 8. Key Decisions and Assumptions

| Decision | Choice | Rationale |
|---|---|---|
| Email filtering | Unread only (`is:unread`) | Simple, honest, zero AI dependency; heuristics can layer in later |
| AI in the app | None | Not needed for v1; keeps the product fast and dependency-free |
| Priority item cap | None | Founder shouldn't be constrained by the tool |
| Priority carry-over | Yes — unchecked items resurface next morning | The product's job is to prevent things being dropped |
| Watchout carry-over | No — date-keyed, fresh each day | Watchouts are day-specific; stale ones add noise |
| Persistence | MongoDB | Reliable cloud storage; survives device switches |
| Google integrations | Direct APIs via OAuth 2.0 | Standard approach for a deployed web app |
| Deployment | Vercel | Fast, free, zero-config for React + serverless API routes |

**Assumptions:**
- Google OAuth consent screen can be configured during demo setup (Calendar + Gmail scopes)
- MongoDB Atlas free tier is sufficient for sprint scope
- Single-user app (Pushkar) — no multi-tenant auth complexity needed