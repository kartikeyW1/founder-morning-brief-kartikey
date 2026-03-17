import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { getAuthedClientWithProfile } from '../_lib/google.js';
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

async function sendEmailViaGmail(gmailAuth: any, to: string, subject: string, html: string) {
  const gmail = google.gmail({ version: 'v1', auth: gmailAuth });

  // Build RFC 2822 email with HTML content
  const rawEmail = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    html,
  ].join('\r\n');

  // Gmail API requires base64url encoding
  const encoded = Buffer.from(rawEmail)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded },
  });
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

  if (!toEmail) {
    return res.status(500).json({ error: 'BRIEF_TO_EMAIL not set' });
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
    const profile = await getAuthedClientWithProfile();
    if (!profile) {
      throw new Error('No Google token found — re-authenticate via the dashboard');
    }
    const { auth, displayName } = profile;

    // If name isn't stored yet, fetch from Google profile and save it
    let userName = displayName;
    if (!userName) {
      try {
        const oauth2Api = google.oauth2({ version: 'v2', auth });
        const { data: userProfile } = await oauth2Api.userinfo.get();
        userName = userProfile.given_name || userProfile.name || '';
        if (userName) {
          const { GoogleToken } = await import('../_lib/models.js');
          await GoogleToken.updateOne({ userId: 'pushkar' }, { displayName: userName });
        }
      } catch {
        userName = '';
      }
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

      html = buildBriefEmail(analysis, meetings, today, userName);
      subjectLine = `Your Morning Brief — ${getDisplayDate()}`;
    } catch (geminiErr) {
      console.error('Gemini failed, sending fallback email:', geminiErr);
      html = buildFallbackEmail(meetings, emails.length, today, userName);
      subjectLine = `Your Morning Brief — ${getDisplayDate()} (lite)`;
    }

    // Preview mode: return HTML directly
    if (isPreview) {
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    }

    // Send email via Gmail API
    await sendEmailViaGmail(auth, toEmail, subjectLine, html);

    // Log successful send for deduplication
    await BriefLog.create({ userId: 'pushkar', date: today });

    res.json({ status: 'sent', date: today });
  } catch (err: any) {
    console.error('Morning brief cron error:', err);

    // Try to send failure notification via Gmail
    if (!isPreview && toEmail) {
      try {
        const profile = await getAuthedClientWithProfile();
        if (profile) {
          await sendEmailViaGmail(
            profile.auth,
            toEmail,
            'Morning Brief — Failed to Generate',
            `<p>Your morning brief failed to generate today. Check Vercel logs.</p><p>Error: ${err.message}</p>`
          );
        }
      } catch (notifyErr) {
        console.error('Failed to send error notification:', notifyErr);
      }
    }

    res.status(500).json({ error: err.message });
  }
}
