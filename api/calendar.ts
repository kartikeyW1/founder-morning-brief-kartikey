import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { getAuthedClient } from './_lib/google.js';
import { getSession } from './_lib/session.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!getSession(req)) return res.status(401).json({ error: 'Not authenticated' });

  const auth = await getAuthedClient();
  if (!auth) return res.status(401).json({ error: 'No Google token' });

  try {
    const calendar = google.calendar({ version: 'v3', auth });
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = (response.data.items || []).map((e) => ({
      id: e.id,
      title: e.summary || '(No title)',
      time: e.start?.dateTime || e.start?.date || '',
      endTime: e.end?.dateTime || e.end?.date || '',
      location: e.location || '',
      meetLink: e.hangoutLink || e.conferenceData?.entryPoints?.[0]?.uri || '',
      isNext: false,
    }));

    // Mark the next upcoming event
    const nowMs = now.getTime();
    for (const event of events) {
      const eventStart = new Date(event.time).getTime();
      const eventEnd = new Date(event.endTime).getTime();
      if (eventEnd > nowMs) {
        event.isNext = true;
        break;
      }
    }

    res.json(events);
  } catch (err: any) {
    console.error('Calendar error:', err);
    if (err.code === 401) {
      return res.status(401).json({ error: 'Token expired' });
    }
    res.status(500).json({ error: 'Failed to fetch calendar' });
  }
}
