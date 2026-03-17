# Morning Brief Email Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Daily 6 AM cron job that fetches calendar + emails, uses Gemini to generate priorities, and sends a styled HTML morning brief email via Resend.

**Architecture:** Single Vercel serverless function (`/api/cron/morning-brief`) triggered by Vercel Cron at 0:30 UTC (6:00 AM IST). Reuses existing `getAuthedClient()` for Google APIs. New modules: Gemini helper, email template builder, cron endpoint. Deduplication via MongoDB `BriefLog` collection.

**Tech Stack:** Vercel Cron, Google Calendar API, Gmail API, Gemini 2.0 Flash (REST API via fetch), Resend (REST API via fetch), MongoDB/Mongoose, TypeScript.

**Spec:** `docs/superpowers/specs/2026-03-17-morning-brief-email-design.md`

---

## File Structure

```
New files:
  api/_lib/time.ts              — Shared IST time formatting utility
  api/_lib/gemini.ts            — Gemini API: prompt builder + JSON parser with retry
  api/_lib/email-template.ts    — HTML email builder (full + fallback templates)
  api/cron/morning-brief.ts    — Cron endpoint: orchestrates fetch → Gemini → email → send

Modified files:
  api/_lib/models.ts            — Add BriefLog schema for deduplication
  server.ts                     — Add local dev route for cron endpoint
  vercel.json                   — Add cron schedule config
  CLAUDE.md                     — Update "no AI" policy to reflect Gemini usage
  .gitignore                    — Add .superpowers/
```

---

## Task 1: Update CLAUDE.md and .gitignore

**Files:**
- Modify: `CLAUDE.md`
- Modify: `.gitignore`

This is a prerequisite — unblocks all other tasks.

- [ ] **Step 1: Update CLAUDE.md AI policy**

In `CLAUDE.md`, find the line:

```
**AI in this app:** None. Zero. Do not add it.
```

Replace with:

```
**AI in this app:** Gemini 2.0 Flash — used exclusively in the morning brief email cron job for generating priorities and day summaries. No AI in the dashboard frontend.
```

Also find in the "What NOT to do" section:

```
- Do not add AI or Claude API anywhere — this version has zero AI
```

Replace with:

```
- Do not add AI to the dashboard frontend — Gemini is only used in the email cron job
```

- [ ] **Step 2: Add .superpowers/ to .gitignore**

Append to `.gitignore`:

```
# Superpowers brainstorming artifacts
.superpowers/
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md .gitignore
git commit -m "chore: update AI policy for Gemini email brief, add .superpowers to gitignore"
```

---

## Task 2: Add BriefLog Model

**Files:**
- Modify: `api/_lib/models.ts`

- [ ] **Step 1: Add BriefLog schema to models.ts**

After the `GoogleTokenSchema` definition (after line 32 in `api/_lib/models.ts`), add:

```typescript
const BriefLogSchema = new Schema({
  userId: { type: String, default: 'pushkar' },
  date: { type: String, required: true },
  sentAt: { type: Date, default: Date.now },
});
```

After the existing exports (after line 37), add:

```typescript
export const BriefLog = mongoose.models.BriefLog || mongoose.model('BriefLog', BriefLogSchema);
```

- [ ] **Step 2: Commit**

```bash
git add api/_lib/models.ts
git commit -m "feat: add BriefLog model for email deduplication"
```

---

## Task 3: Create Shared Time Utility

**Files:**
- Create: `api/_lib/time.ts`

- [ ] **Step 1: Create api/_lib/time.ts**

```typescript
export function formatTimeIST(iso: string): string {
  if (!iso || iso.length === 10) return 'All day';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add api/_lib/time.ts
git commit -m "feat: add shared IST time formatting utility"
```

---

## Task 4: Build Gemini Helper

**Files:**
- Create: `api/_lib/gemini.ts`

- [ ] **Step 1: Create api/_lib/gemini.ts**

```typescript
import { formatTimeIST } from './time.js';

interface CalendarEvent {
  time: string;
  endTime: string;
  title: string;
  location: string;
}

interface EmailMeta {
  sender: string;
  subject: string;
  receivedAt: string;
}

export interface GeminiAnalysis {
  priorities: string[];
  daySummary: string;
  keyMeetingIndices: number[];
}

function buildPrompt(
  events: CalendarEvent[],
  emails: EmailMeta[],
  dateStr: string
): { system: string; user: string } {
  const calendarBlock =
    events.length > 0
      ? events
          .map((e) => {
            const start = formatTimeIST(e.time);
            const end = formatTimeIST(e.endTime);
            const loc = e.location ? ` (${e.location})` : '';
            return `- ${start} – ${end}: ${e.title}${loc}`;
          })
          .join('\n')
      : 'No meetings today.';

  const emailBlock =
    emails.length > 0
      ? emails
          .map(
            (e, i) =>
              `${i + 1}. From: ${e.sender} | Subject: ${e.subject} | ${e.receivedAt}`
          )
          .join('\n')
      : 'No unread emails.';

  const system = `You are a concise executive assistant. Analyze today's calendar and unread emails for a startup founder. Be direct, no fluff.`;

  const user = `Today is ${dateStr}.

CALENDAR (${events.length} events):
${calendarBlock}

UNREAD EMAILS (${emails.length}):
${emailBlock}

RESPOND IN THIS EXACT JSON FORMAT:
{
  "priorities": ["action item 1", "action item 2"],
  "daySummary": "one or two sentence overview",
  "keyMeetingIndices": [0, 2]
}

RULES:
- priorities: 3-6 actionable items synthesized from calendar + emails.
  Start each with a verb. Most important first.
  ONLY reference meetings and emails provided above. Never invent events, people, or tasks that don't appear in the input.
  If multiple emails are from the same thread, treat as one item.
  Ignore promotional, newsletter, and automated notification emails.
  Handle email subjects in any language.
- daySummary: mention meeting count, busiest time block, unread count, and anything urgent. If no meetings, say so. If no emails, say so.
- keyMeetingIndices: indices (0-based) of high-stakes meetings (investor calls, board meetings, external parties, deadlines). Routine standups and 1:1s are NOT key. Return empty array if none are key.

If calendar is empty AND inbox is empty, return:
{
  "priorities": ["No scheduled events or pending emails - open day"],
  "daySummary": "Clear calendar and empty inbox.",
  "keyMeetingIndices": []
}`;

  return { system, user };
}

function parseGeminiJSON(text: string): GeminiAnalysis {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  const parsed = JSON.parse(cleaned);

  // Validate structure
  if (!Array.isArray(parsed.priorities) || typeof parsed.daySummary !== 'string' || !Array.isArray(parsed.keyMeetingIndices)) {
    throw new Error('Invalid Gemini response structure');
  }

  return {
    priorities: parsed.priorities.map(String),
    daySummary: String(parsed.daySummary),
    keyMeetingIndices: parsed.keyMeetingIndices
      .filter((i: unknown) => typeof i === 'number' && Number.isInteger(i) && i >= 0)
      .map(Number),
  };
}

export async function analyzeWithGemini(
  events: CalendarEvent[],
  emails: EmailMeta[],
  dateStr: string
): Promise<GeminiAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const { system, user } = buildPrompt(events, emails, dateStr);

  const callGemini = async (): Promise<GeminiAnalysis> => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${errBody}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty Gemini response');

    return parseGeminiJSON(text);
  };

  // Try once, retry on failure
  try {
    return await callGemini();
  } catch (firstErr) {
    console.error('Gemini first attempt failed:', firstErr);
    try {
      return await callGemini();
    } catch (retryErr) {
      console.error('Gemini retry failed:', retryErr);
      throw retryErr;
    }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add api/_lib/gemini.ts
git commit -m "feat: add Gemini helper with prompt builder and JSON parser"
```

---

## Task 5: Build Email Template

**Files:**
- Create: `api/_lib/email-template.ts`

- [ ] **Step 1: Create api/_lib/email-template.ts**

```typescript
import type { GeminiAnalysis } from './gemini.js';
import { formatTimeIST } from './time.js';

interface Meeting {
  time: string;
  endTime: string;
  title: string;
  location: string;
  meetLink: string;
}

function meetingRow(m: Meeting, isKey: boolean): string {
  const time = formatTimeIST(m.time);
  const dot = isKey
    ? '<span style="color:#1a8aff;font-size:10px;">&#9679;</span>'
    : '<span style="color:#999;font-size:10px;">&#9675;</span>';
  const joinBtn = m.meetLink
    ? `<a href="${m.meetLink}" style="color:#1a8aff;font-size:12px;text-decoration:none;font-weight:500;margin-left:12px;">Join</a>`
    : '';
  const loc = m.location ? ` <span style="color:#999;font-size:12px;">(${m.location})</span>` : '';
  return `
    <tr>
      <td style="padding:6px 0;vertical-align:top;width:20px;">${dot}</td>
      <td style="padding:6px 8px;vertical-align:top;color:#666;font-size:13px;white-space:nowrap;width:80px;">${time}</td>
      <td style="padding:6px 0;vertical-align:top;font-size:14px;color:#1a1a1a;">${m.title}${loc}${joinBtn}</td>
    </tr>`;
}

function card(title: string, content: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr>
        <td style="background:rgba(255,255,255,0.75);border-radius:12px;padding:20px 24px;box-shadow:0 2px 12px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.1);">
          <p style="margin:0 0 12px 0;font-size:11px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:#999;">${title}</p>
          ${content}
        </td>
      </tr>
    </table>`;
}

export function buildBriefEmail(
  analysis: GeminiAnalysis,
  meetings: Meeting[],
  dateStr: string,
  name: string
): string {
  // Format date for display
  const d = new Date(dateStr + 'T00:00:00+05:30');
  const displayDate = d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

  // Greeting based on time (always morning since sent at 6 AM)
  const greeting = `Good morning, ${name}.`;

  // Priorities card
  const prioritiesHtml = analysis.priorities
    .map(
      (p) =>
        `<tr><td style="padding:4px 0;vertical-align:top;width:20px;color:#1a8aff;font-size:14px;">&#8226;</td><td style="padding:4px 0;font-size:14px;color:#1a1a1a;line-height:1.5;">${p}</td></tr>`
    )
    .join('');
  const prioritiesCard = card(
    'Today\'s Priorities',
    `<table cellpadding="0" cellspacing="0">${prioritiesHtml}</table>`
  );

  // Day at a glance card
  const summaryCard = card(
    'Day at a Glance',
    `<p style="margin:0;font-size:14px;color:#333;line-height:1.6;">${analysis.daySummary}</p>`
  );

  // Meetings card — tiered by key vs routine
  const keyIndicesSet = new Set(
    analysis.keyMeetingIndices.filter((i) => i >= 0 && i < meetings.length)
  );
  const keyMeetings = meetings.filter((_, i) => keyIndicesSet.has(i));
  const routineMeetings = meetings.filter((_, i) => !keyIndicesSet.has(i));

  let meetingsContent = '';

  if (meetings.length === 0) {
    meetingsContent = `<p style="margin:0;font-size:14px;color:#666;">No meetings today.</p>`;
  } else {
    if (keyMeetings.length > 0) {
      meetingsContent += `
        <p style="margin:0 0 8px 0;font-size:11px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:#1a8aff;">Key Meetings</p>
        <table cellpadding="0" cellspacing="0" width="100%">
          ${keyMeetings.map((m) => meetingRow(m, true)).join('')}
        </table>`;
    }
    if (routineMeetings.length > 0) {
      const alsoLabel = keyMeetings.length > 0
        ? `<p style="margin:16px 0 8px 0;font-size:11px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:#999;">Also Today</p>`
        : '';
      meetingsContent += `
        ${alsoLabel}
        <table cellpadding="0" cellspacing="0" width="100%">
          ${routineMeetings.map((m) => meetingRow(m, false)).join('')}
        </table>`;
    }
  }

  const meetingsCard = card('Meetings', meetingsContent);

  // Full email
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Morning Brief</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:24px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <!-- Header -->
          <tr>
            <td style="background:rgba(255,255,255,0.85);border-radius:16px 16px 0 0;padding:32px 24px 24px 24px;box-shadow:0 2px 12px rgba(0,0,0,0.06);text-align:center;">
              <h1 style="margin:0 0 4px 0;font-size:22px;font-weight:400;color:#1a1a1a;">${greeting}</h1>
              <p style="margin:0;font-size:14px;color:#999;font-weight:300;">${displayDate}</p>
            </td>
          </tr>
          <tr><td style="height:16px;"></td></tr>

          <!-- Priorities -->
          <tr><td>${prioritiesCard}</td></tr>

          <!-- Day Summary -->
          <tr><td>${summaryCard}</td></tr>

          <!-- Meetings -->
          <tr><td>${meetingsCard}</td></tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 24px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#bbb;font-weight:400;">Founder Morning Brief &middot; 6:00 AM IST</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildFallbackEmail(
  meetings: Meeting[],
  emailCount: number,
  dateStr: string,
  name: string
): string {
  const d = new Date(dateStr + 'T00:00:00+05:30');
  const displayDate = d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

  let meetingsHtml = '';
  if (meetings.length === 0) {
    meetingsHtml = `<p style="margin:0;font-size:14px;color:#666;">No meetings today.</p>`;
  } else {
    meetingsHtml = `<table cellpadding="0" cellspacing="0" width="100%">
      ${meetings.map((m) => meetingRow(m, false)).join('')}
    </table>`;
  }

  const meetingsCard = card('Meetings', meetingsHtml);
  const inboxCard = card(
    'Inbox',
    `<p style="margin:0;font-size:14px;color:#333;">${emailCount} unread email${emailCount !== 1 ? 's' : ''} in your inbox.</p>`
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Morning Brief</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:24px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="background:rgba(255,255,255,0.85);border-radius:16px 16px 0 0;padding:32px 24px 24px 24px;box-shadow:0 2px 12px rgba(0,0,0,0.06);text-align:center;">
              <h1 style="margin:0 0 4px 0;font-size:22px;font-weight:400;color:#1a1a1a;">Good morning, ${name}.</h1>
              <p style="margin:0;font-size:14px;color:#999;font-weight:300;">${displayDate}</p>
            </td>
          </tr>
          <tr><td style="height:16px;"></td></tr>
          <tr><td>${meetingsCard}</td></tr>
          <tr><td>${inboxCard}</td></tr>
          <tr>
            <td style="padding:16px 24px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#bbb;">Founder Morning Brief (lite) &middot; 6:00 AM IST</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
```

- [ ] **Step 2: Commit**

```bash
git add api/_lib/email-template.ts
git commit -m "feat: add HTML email template builder with full and fallback modes"
```

---

## Task 6: Build Cron Endpoint

**Files:**
- Create: `api/cron/morning-brief.ts`

This is the main orchestrator. It depends on Tasks 2, 4, and 5.

- [ ] **Step 1: Create api/cron/morning-brief.ts**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { getAuthedClient } from '../_lib/google.js';
import { connectDB } from '../_lib/db.js';
import { BriefLog } from '../_lib/models.js';
import { analyzeWithGemini } from '../_lib/gemini.js';
import { buildBriefEmail, buildFallbackEmail } from '../_lib/email-template.js';

function getTodayIST(): string {
  const now = new Date();
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
}

function getDisplayDate(): string {
  const now = new Date();
  return now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

async function fetchCalendarEvents(auth: any) {
  const calendar = google.calendar({ version: 'v3', auth });
  const now = new Date();
  // Use IST for day boundaries
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  const startOfDay = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()) - istOffset);
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  return (response.data.items || [])
    .filter((e) => e.status !== 'cancelled' && e.attendees?.find(
      (a) => a.self && a.responseStatus === 'declined'
    ) === undefined)
    .map((e) => ({
      id: e.id,
      title: e.summary || '(No title)',
      time: e.start?.dateTime || e.start?.date || '',
      endTime: e.end?.dateTime || e.end?.date || '',
      location: e.location || '',
      meetLink: e.hangoutLink || e.conferenceData?.entryPoints?.[0]?.uri || '',
    }));
}

async function fetchUnreadEmails(auth: any) {
  const gmail = google.gmail({ version: 'v1', auth });
  const list = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread',
    maxResults: 20,
  });

  const messages = list.data.messages || [];
  return Promise.all(
    messages.map(async (m) => {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: m.id!,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      });
      const headers = msg.data.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name === name)?.value || '';

      const fromRaw = getHeader('From');
      const senderMatch = fromRaw.match(/^(.+?)(?:\s*<.*>)?$/);
      const sender = senderMatch ? senderMatch[1].replace(/"/g, '').trim() : fromRaw;

      return {
        sender,
        subject: getHeader('Subject') || '(No subject)',
        receivedAt: getHeader('Date'),
      };
    })
  );
}

async function sendEmail(to: string, from: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Resend error ${res.status}: ${errBody}`);
  }

  return res.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Auth check — verify cron secret
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const isPreview = req.query?.preview === 'true';
  const today = getTodayIST();
  const toEmail = process.env.BRIEF_TO_EMAIL;
  const fromEmail = process.env.BRIEF_FROM_EMAIL;

  if (!toEmail || !fromEmail) {
    return res.status(500).json({ error: 'BRIEF_TO_EMAIL or BRIEF_FROM_EMAIL not set' });
  }

  try {
    await connectDB();

    // Deduplication: skip if already sent today (unless preview)
    if (!isPreview) {
      const existing = await BriefLog.findOne({ date: today, userId: 'pushkar' });
      if (existing) {
        return res.json({ status: 'already_sent', date: today });
      }
    }

    // Fetch Google data
    const auth = await getAuthedClient();
    if (!auth) {
      throw new Error('No Google token found — re-authenticate via the dashboard');
    }

    const [meetings, emails] = await Promise.all([
      fetchCalendarEvents(auth),
      fetchUnreadEmails(auth),
    ]);

    // Try Gemini analysis
    let html: string;
    let subjectLine: string;

    try {
      const analysis = await analyzeWithGemini(meetings, emails, getDisplayDate());

      // Validate keyMeetingIndices bounds
      analysis.keyMeetingIndices = analysis.keyMeetingIndices.filter(
        (i) => i >= 0 && i < meetings.length
      );

      html = buildBriefEmail(analysis, meetings, today, 'Pushkar');
      subjectLine = `Your Morning Brief — ${getDisplayDate()}`;
    } catch (geminiErr) {
      console.error('Gemini failed, sending fallback email:', geminiErr);
      html = buildFallbackEmail(meetings, emails.length, today, 'Pushkar');
      subjectLine = `Your Morning Brief — ${getDisplayDate()} (lite)`;
    }

    // Preview mode: return HTML directly
    if (isPreview) {
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    }

    // Send email via Resend
    await sendEmail(toEmail, fromEmail, subjectLine, html);

    // Log successful send for deduplication
    await BriefLog.create({ userId: 'pushkar', date: today });

    res.json({ status: 'sent', date: today });
  } catch (err: any) {
    console.error('Morning brief cron error:', err);

    // Try to send failure notification
    if (!isPreview && toEmail && fromEmail) {
      try {
        await sendEmail(
          toEmail,
          fromEmail,
          'Morning Brief — Failed to Generate',
          `<p>Your morning brief failed to generate today. Check Vercel logs.</p><p>Error: ${err.message}</p>`
        );
      } catch (notifyErr) {
        console.error('Failed to send error notification:', notifyErr);
      }
    }

    res.status(500).json({ error: err.message });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add api/cron/morning-brief.ts
git commit -m "feat: add morning brief cron endpoint with full pipeline"
```

---

## Task 7: Wire Up Local Dev Server + Vercel Config

**Files:**
- Modify: `server.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Add cron route to server.ts**

Add import at the top of `server.ts`, after the existing imports (after line 14):

```typescript
import morningBrief from './api/cron/morning-brief.js';
```

Add the route after the intention routes (after line 72):

```typescript
app.get('/api/cron/morning-brief', adapt(morningBrief));
```

- [ ] **Step 2: Update vercel.json with cron config**

Replace the contents of `vercel.json` with:

```json
{
  "crons": [
    {
      "path": "/api/cron/morning-brief",
      "schedule": "30 0 * * *"
    }
  ],
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add server.ts vercel.json
git commit -m "feat: wire up cron route in dev server and Vercel config"
```

---

## Task 8: Add Environment Variables and Test Locally

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Add new env vars to .env.local**

Append to `.env.local`:

```bash
# Morning Brief Email
GEMINI_API_KEY=<your-gemini-api-key>
RESEND_API_KEY=<your-resend-api-key>
CRON_SECRET=morning-brief-cron-secret-change-me
BRIEF_TO_EMAIL=pushkar@lemnisca.bio
BRIEF_FROM_EMAIL=onboarding@resend.dev
```

Note: `BRIEF_FROM_EMAIL` uses Resend's test sender for development. Update to verified domain for production.

- [ ] **Step 2: Start the dev server**

```bash
npm run dev
```

Expected: both Vite and Express server start without errors.

- [ ] **Step 3: Test preview mode**

```bash
curl -H "Authorization: Bearer morning-brief-cron-secret-change-me" \
  "http://localhost:3001/api/cron/morning-brief?preview=true"
```

Expected: HTML response with the morning brief email. Open in browser to verify layout.

- [ ] **Step 4: Test auth rejection**

```bash
curl "http://localhost:3001/api/cron/morning-brief"
```

Expected: `{"error":"Unauthorized"}` with 401 status.

- [ ] **Step 5: Test real email send**

```bash
curl -H "Authorization: Bearer morning-brief-cron-secret-change-me" \
  "http://localhost:3001/api/cron/morning-brief"
```

Expected: `{"status":"sent","date":"2026-03-17"}` and email arrives at `pushkar@lemnisca.bio`.

- [ ] **Step 6: Test deduplication**

Run the same curl command again:

```bash
curl -H "Authorization: Bearer morning-brief-cron-secret-change-me" \
  "http://localhost:3001/api/cron/morning-brief"
```

Expected: `{"status":"already_sent","date":"2026-03-17"}` — no duplicate email.

- [ ] **Step 7: Do NOT commit .env.local** (it's in .gitignore)

---

## Task 9: Deploy and Verify

- [ ] **Step 1: Add environment variables to Vercel**

In Vercel project settings, add:
- `GEMINI_API_KEY`
- `RESEND_API_KEY`
- `CRON_SECRET`
- `BRIEF_TO_EMAIL` = `pushkar@lemnisca.bio`
- `BRIEF_FROM_EMAIL` = verified sender domain email

- [ ] **Step 2: Deploy**

```bash
git push
```

Vercel auto-deploys from the push.

- [ ] **Step 3: Test deployed endpoint manually**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://your-domain.vercel.app/api/cron/morning-brief?preview=true"
```

Expected: HTML preview of the morning brief.

- [ ] **Step 4: Verify cron is registered**

Check Vercel dashboard → Project → Settings → Cron Jobs. Should show `/api/cron/morning-brief` scheduled at `30 0 * * *`.

- [ ] **Step 5: Wait for 6 AM IST the next day and verify email arrives**

---

## Dependency Order

```
Task 1 (CLAUDE.md + .gitignore)     — no dependencies
Task 2 (BriefLog model)             — no dependencies
Task 3 (Shared time utility)        — no dependencies
Task 4 (Gemini helper)              — depends on Task 3
Task 5 (Email template)             — depends on Tasks 3 and 4 (imports GeminiAnalysis type + formatTimeIST)
Task 6 (Cron endpoint)              — depends on Tasks 2, 4, 5
Task 7 (Server + Vercel config)     — depends on Task 6
Task 8 (Env vars + local testing)   — depends on Task 7
Task 9 (Deploy + verify)            — depends on Task 8
```

Tasks 1, 2, and 3 can run in parallel. Task 4 depends on 3. Task 5 depends on 3+4. Tasks 6-9 are sequential.
