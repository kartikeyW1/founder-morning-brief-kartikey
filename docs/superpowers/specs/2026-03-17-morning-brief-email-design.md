# Morning Brief Email — Design Spec

**Date:** 2026-03-17
**Status:** Approved
**Scope:** Daily 6 AM email that replaces the dashboard as the primary morning brief for Pushkar.

---

## Overview

A Vercel Cron job triggers a single serverless function daily at 6:00 AM IST. The function fetches today's Google Calendar events and unread Gmail metadata, sends both to Gemini 2.0 Flash for analysis, builds a styled HTML email, and sends it via Resend to `pushkar@lemnisca.bio`.

The email is the complete brief — Pushkar does not need to open the dashboard.

---

## Architecture

### Approach: Single Serverless Function

```
Vercel Cron (6:00 AM IST / 0:30 UTC)
       |
       v
  /api/cron/morning-brief
       |
       |-- Verify CRON_SECRET header
       |-- getAuthedClient('pushkar')     <-- reuse existing token logic
       |         |
       |         |-- Google Calendar API  --> today's events (filter out declined)
       |         |-- Gmail API (is:unread) --> up to 20 emails (metadata only)
       |
       |-- Gemini 2.0 Flash
       |     Input: calendar events + email metadata (sender, subject, date)
       |     Output: JSON { priorities, daySummary, keyMeetingIndices }
       |
       |-- Build HTML email from Gemini output + raw meeting data
       |
       |-- Resend API (fetch POST)
             To: BRIEF_TO_EMAIL
             From: BRIEF_FROM_EMAIL
             Subject: "Your Morning Brief -- {Day}, {Month} {Date}"
```

### Why This Approach

- One function, one trigger, zero new infrastructure
- Reuses existing `getAuthedClient()` and token refresh logic from `api/_lib/google.ts`
- The entire flow (2 Google API calls + 1 Gemini call + 1 Resend call) takes ~3-5s typical, within Vercel Hobby plan's 10s serverless timeout
- No intermediate storage, no queues, no multi-step pipeline needed for a single daily email

### Prerequisites

Before any code is written:
1. Update CLAUDE.md to reflect that Gemini is now used in the email brief (replace "no AI" policy)
2. This unblocks all implementation work

---

## Gemini Integration

### Model

Gemini 2.0 Flash — fast, cheap, sufficient for summarizing ~20 email subjects + a day of calendar events.

### Input

Gemini receives:
- Today's calendar events: time, end time, title, location
- Unread email metadata only: sender name, subject line, date received
- **No email bodies** — subject lines carry enough signal, avoids privacy concerns

### Prompt Structure

```
System: You are a concise executive assistant. Analyze today's calendar
and unread emails for a startup founder. Be direct, no fluff.

User:
Today is {Day}, {Month} {Date}, {Year}.

CALENDAR ({count} events):
- 9:00 AM - 9:30 AM: Team standup
- 2:00 PM - 3:00 PM: Series A discussion with Sequoia
...
(or "No meetings today." if empty)

UNREAD EMAILS ({count}):
1. From: John Smith | Subject: Partnership proposal - next steps | Mar 16
2. From: Legal Team | Subject: Contract review needed urgently | Mar 16
...
(or "No unread emails." if empty)

RESPOND IN THIS EXACT JSON FORMAT:
{
  "priorities": ["action item 1", "action item 2", ...],
  "daySummary": "one or two sentence overview",
  "keyMeetingIndices": [0, 2]
}

RULES:
- priorities: 3-6 actionable items synthesized from calendar + emails.
  Start each with a verb. Most important first.
  ONLY reference meetings and emails provided above. Never invent events,
  people, or tasks that don't appear in the input.
  If multiple emails are from the same thread, treat as one item.
  Ignore promotional, newsletter, and automated notification emails.
  Handle email subjects in any language.
- daySummary: mention meeting count, busiest time block, unread count,
  and anything urgent. If no meetings, say so. If no emails, say so.
- keyMeetingIndices: indices of high-stakes meetings (investor calls,
  board meetings, external parties, deadlines). Routine standups
  and 1:1s are NOT key. Return empty array if none are key.

If calendar is empty AND inbox is empty, return:
  priorities: ["No scheduled events or pending emails - open day"],
  daySummary: "Clear calendar and empty inbox.",
  keyMeetingIndices: []
```

### Output

Structured JSON response. Gemini may wrap JSON in markdown code fences (```json ... ```) — strip these before parsing. Parse with try/catch. On parse failure: retry once. On second failure: send fallback email (see Fallback Template below).

### Token Estimate

~500 input tokens + ~200 output tokens. Well under Flash limits, ~1-2s response time.

---

## Edge Cases

| Edge Case | Handling |
|---|---|
| 0 meetings | Prompt handles: "No meetings today" in summary |
| 0 unread emails | Prompt handles: focus priorities on calendar only |
| All-day events | Format as "All day: Event Name" in prompt |
| Declined meetings | Filter out server-side before sending to Gemini |
| Non-English subjects | Prompt: "Handle subjects in any language" |
| Spam/newsletter subjects | Prompt: "Ignore promotional, newsletter, automated emails" |
| Token refresh failure | Skip email, log error. Don't send partial data |
| Gemini returns malformed JSON | Parse with try/catch, retry once. Fallback to raw-data-only email |
| Gemini hallucinates | Prompt: "ONLY reference provided input. Never invent." |
| Duplicate thread emails | Prompt: "Treat same-thread emails as one item" |
| Weekend/holiday (empty day) | Handled by empty calendar+email prompt branch |
| keyMeetingIndices out of bounds | Validate indices against meetings array length server-side |

---

## Email Template

### Visual Design

- **Style:** Clean light base with frosted glass cards
- **Page background:** Light gray (`#f0f2f5`)
- **Cards:** White with low opacity (`rgba(255,255,255,0.75)`), soft `box-shadow` for depth
- **Glass effect:** Faked with semi-transparent backgrounds + layered shadows (no `backdrop-filter` — unsupported in email clients)
- **Accent:** Blue (`#1a8aff`) for key meeting indicators and section labels
- **Font:** System sans-serif stack (`'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`). Inter is aspirational — most email clients strip external font imports, so system fonts are the real fallback.
- **Subject line:** `Your Morning Brief -- Tuesday, Mar 17`

### Layout

```
+--------------------------------------------------+
|  [frosted header]                                 |
|  Good morning, Pushkar.                           |
|  Tuesday, March 17, 2026                          |
+--------------------------------------------------+
|                                                   |
|  [frosted card] TODAY'S PRIORITIES                |
|  * Prep for 2pm investor call with Sequoia        |
|  * Reply to Legal Team -- contract review         |
|  * Review Q1 metrics from Sarah                   |
|  * Follow up on partnership proposal              |
|                                                   |
|  [frosted card] DAY AT A GLANCE                   |
|  4 meetings, heaviest block 2-5 PM.               |
|  14 unread emails, 2 look urgent.                 |
|                                                   |
|  [frosted card] KEY MEETINGS                      |
|  (blue dot) 2:00 PM  Series A -- Sequoia  [Join]  |
|  (blue dot) 4:30 PM  Board sync           [Join]  |
|                                                   |
|  ALSO TODAY                                       |
|  (gray dot) 9:00 AM  Team standup         [Join]  |
|  (gray dot) 11:00 AM Design review        [Join]  |
|                                                   |
|  [footer]                                         |
|  Founder Morning Brief -- 6:00 AM IST             |
+--------------------------------------------------+
```

### Cognitive Order

1. AI priorities (what to do) — most valuable, shown first
2. Day summary (context) — quick orientation
3. Tiered meetings (reference) — with clickable join links

### Join Links

Rendered as small blue buttons. Clickable meet links (Google Meet / Zoom / etc.) directly in the email. One tap to join from phone or desktop.

### Array Order Invariant

The same meetings array (same order) MUST be used for both the Gemini prompt input and the email template rendering. `keyMeetingIndices` from Gemini reference positions in this array — any reordering between prompt and template will map to wrong meetings.

### Fallback Template (Gemini failure)

If Gemini fails after retry, send a degraded email:
- **Subject:** `Your Morning Brief -- {Day}, {Month} {Date} (lite)`
- **Content:** Greeting + all meetings in a flat list (no tiering) with join links + "X unread emails in your inbox" count
- **No AI sections:** No priorities, no day summary
- This ensures Pushkar always gets something useful even if Gemini is down

---

## Security

### Cron Endpoint Auth

- Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically
- Endpoint verifies this header — rejects requests without it
- Local testing: pass the same header manually via curl
- `?preview=true` mode also requires the secret

### Data Privacy

- Email bodies are never read — only metadata (sender, subject, date)
- Gemini receives no PII beyond names and email subjects
- No data stored from the cron job — fetch, process, send, done

---

## Testing Strategy

### Local Development

```bash
# Preview HTML without sending email
curl -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3001/api/cron/morning-brief?preview=true"

# Send real email locally
curl -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3001/api/cron/morning-brief"
```

### Preview Mode

`?preview=true` returns the rendered HTML directly in the response instead of sending via Resend. Use for iterating on template design.

### Post-Deploy

The endpoint can be triggered manually at any time:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://yourdomain.com/api/cron/morning-brief"
```

The Vercel cron schedule only controls automatic triggers — the function itself can be called manually.

### Deduplication

Before sending, check if a brief was already sent today (store a simple `{ date, sentAt }` record in MongoDB). If already sent and not in `?preview=true` mode, return early. This prevents accidental duplicate emails from manual triggers or cron retries.

### Failure Alerting

If the cron job fails (token refresh, Gemini outage, Resend error), send a minimal plain-text fallback email via Resend: "Your morning brief failed to generate today. Check Vercel logs." This ensures Pushkar knows something broke rather than silently missing the brief.

---

## Environment Variables (New)

```bash
GEMINI_API_KEY=           # Gemini 2.0 Flash API key
RESEND_API_KEY=           # Resend email sending
CRON_SECRET=              # Auth for cron endpoint (Vercel + manual)
BRIEF_TO_EMAIL=pushkar@lemnisca.bio    # Recipient
BRIEF_FROM_EMAIL=brief@yourdomain.com  # Sender (needs verified Resend domain)
```

**Resend domain setup:** Verify a sending domain in Resend dashboard (DNS records). Use `onboarding@resend.dev` for development.

---

## New Files

```
api/cron/morning-brief.ts    -- Cron endpoint: fetch -> Gemini -> email -> send
api/_lib/gemini.ts            -- Gemini API helper: prompt builder + JSON parser
api/_lib/email-template.ts    -- HTML email builder function
```

## Modified Files

```
vercel.json                   -- Add cron config
.env.local                    -- Add 4 new env vars
CLAUDE.md                     -- Update "no AI" to reflect Gemini usage in email
.gitignore                    -- Add .superpowers/
```

## vercel.json Cron Config

```json
{
  "crons": [
    {
      "path": "/api/cron/morning-brief",
      "schedule": "30 0 * * *"
    }
  ]
}
```

`0:30 UTC` = `6:00 AM IST`

---

## What This Does NOT Change

- No changes to existing frontend components
- No changes to existing API routes (priorities, watchouts, intention, calendar, emails)
- One new lightweight MongoDB collection: `BriefLog` (`{ date, sentAt }`) for deduplication only
- The dashboard continues to work independently
