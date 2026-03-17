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
