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
  const endTime = formatTimeIST(m.endTime);
  const timeRange = time === 'All day' ? 'ALL DAY' : `${time} — ${endTime}`;
  const joinBtn = m.meetLink
    ? `<a href="${m.meetLink}" style="display:inline-block;padding:5px 16px;background:#1a1a1a;color:#ffffff;font-size:11px;font-weight:500;text-decoration:none;border-radius:6px;letter-spacing:0.03em;">Join &rarr;</a>`
    : '';
  const loc = m.location ? `<div style="font-size:12px;color:#8a8a8a;margin-top:3px;font-style:italic;">${m.location}</div>` : '';
  const accent = isKey ? '#1a8aff' : '#d4d4d4';

  return `
    <tr>
      <td style="padding:10px 0;">
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="border-left:3px solid ${accent};padding-left:16px;vertical-align:top;">
              <div style="font-size:11px;color:${isKey ? '#1a8aff' : '#999'};font-weight:600;letter-spacing:0.04em;margin-bottom:4px;">${timeRange}</div>
              <div style="font-size:15px;color:#1a1a1a;line-height:1.45;font-weight:400;">${m.title}</div>
              ${loc}
            </td>
            <td style="vertical-align:middle;text-align:right;width:80px;padding-left:12px;">${joinBtn}</td>
          </tr>
        </table>
      </td>
    </tr>`;
}

export function buildBriefEmail(
  analysis: GeminiAnalysis,
  meetings: Meeting[],
  dateStr: string,
  name: string
): string {
  const d = new Date(dateStr + 'T00:00:00+05:30');
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' });
  const monthDay = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' });
  const year = d.toLocaleDateString('en-US', { year: 'numeric', timeZone: 'Asia/Kolkata' });

  // Priorities — numbered
  const prioritiesHtml = analysis.priorities
    .map(
      (p, i) =>
        `<tr>
          <td style="padding:8px 0;vertical-align:top;width:32px;">
            <div style="width:24px;height:24px;border-radius:6px;background:#f0f4ff;color:#1a8aff;font-size:12px;font-weight:600;text-align:center;line-height:24px;">${i + 1}</div>
          </td>
          <td style="padding:8px 0;padding-left:12px;font-size:15px;color:#2a2a2a;line-height:1.55;">${p}</td>
        </tr>`
    )
    .join('');

  // Meetings — tiered
  const keyIndicesSet = new Set(
    analysis.keyMeetingIndices.filter((i) => i >= 0 && i < meetings.length)
  );
  const keyMeetings = meetings.filter((_, i) => keyIndicesSet.has(i));
  const routineMeetings = meetings.filter((_, i) => !keyIndicesSet.has(i));

  let meetingsContent = '';
  if (meetings.length === 0) {
    meetingsContent = `<p style="margin:0;font-size:15px;color:#999;padding:8px 0;">No meetings on your calendar today.</p>`;
  } else {
    if (keyMeetings.length > 0) {
      meetingsContent += `
        <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:${routineMeetings.length > 0 ? '12px' : '0'};">
          ${keyMeetings.map((m) => meetingRow(m, true)).join('')}
        </table>`;
    }
    if (routineMeetings.length > 0) {
      const sep = keyMeetings.length > 0
        ? `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:8px 0;"><div style="height:1px;background:#f0f0f0;"></div></td></tr></table>`
        : '';
      meetingsContent += `${sep}
        <table cellpadding="0" cellspacing="0" width="100%">
          ${routineMeetings.map((m) => meetingRow(m, false)).join('')}
        </table>`;
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Morning Brief</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;">

          <!-- Header -->
          <tr>
            <td style="padding:0 0 40px 0;text-align:center;">
              <p style="margin:0 0 16px 0;font-size:11px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#1a8aff;">Morning Brief</p>
              <h1 style="margin:0 0 8px 0;font-size:32px;font-weight:400;color:#1a1a1a;font-family:'Playfair Display','Georgia',serif;letter-spacing:-0.01em;">Good morning, ${name}.</h1>
              <p style="margin:0;font-size:14px;color:#999;font-weight:300;letter-spacing:0.02em;">${weekday}, ${monthDay}, ${year}</p>
            </td>
          </tr>

          <!-- Day Summary — standalone line -->
          <tr>
            <td style="padding:0 0 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#ffffff;border-radius:12px;padding:20px 24px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
                    <p style="margin:0;font-size:14px;color:#555;line-height:1.65;">${analysis.daySummary}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Priorities -->
          <tr>
            <td style="padding:0 0 8px 0;">
              <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#bbb;">What to focus on</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#ffffff;border-radius:12px;padding:20px 24px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
                    <table cellpadding="0" cellspacing="0" width="100%">${prioritiesHtml}</table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Meetings -->
          <tr>
            <td style="padding:0 0 8px 0;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#bbb;">Schedule</td>
                  <td style="padding-left:10px;font-size:11px;color:#d0d0d0;">${meetings.length} meeting${meetings.length !== 1 ? 's' : ''}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#ffffff;border-radius:12px;padding:20px 24px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
                    ${meetingsContent}
                  </td>
                </tr>
              </table>
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
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' });
  const monthDay = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' });
  const year = d.toLocaleDateString('en-US', { year: 'numeric', timeZone: 'Asia/Kolkata' });

  let meetingsHtml = '';
  if (meetings.length === 0) {
    meetingsHtml = `<p style="margin:0;font-size:15px;color:#999;padding:8px 0;">No meetings on your calendar today.</p>`;
  } else {
    meetingsHtml = `<table cellpadding="0" cellspacing="0" width="100%">
      ${meetings.map((m) => meetingRow(m, false)).join('')}
    </table>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Morning Brief</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;">

          <tr>
            <td style="padding:0 0 40px 0;text-align:center;">
              <p style="margin:0 0 16px 0;font-size:11px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#1a8aff;">Morning Brief</p>
              <h1 style="margin:0 0 8px 0;font-size:32px;font-weight:400;color:#1a1a1a;font-family:'Playfair Display','Georgia',serif;">Good morning, ${name}.</h1>
              <p style="margin:0;font-size:14px;color:#999;font-weight:300;letter-spacing:0.02em;">${weekday}, ${monthDay}, ${year}</p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 0 8px 0;">
              <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#bbb;">Schedule</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#ffffff;border-radius:12px;padding:20px 24px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
                    ${meetingsHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 0 8px 0;">
              <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#bbb;">Inbox</p>
            </td>
          </tr>
          <tr>
            <td>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#ffffff;border-radius:12px;padding:20px 24px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
                    <p style="margin:0;font-size:15px;color:#555;">${emailCount} unread email${emailCount !== 1 ? 's' : ''} in your inbox.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
