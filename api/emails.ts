import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { getAuthedClient } from './_lib/google.js';
import { getSession } from './_lib/session.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!getSession(req)) return res.status(401).json({ error: 'Not authenticated' });

  const auth = await getAuthedClient();
  if (!auth) return res.status(401).json({ error: 'No Google token' });

  try {
    const gmail = google.gmail({ version: 'v1', auth });
    const list = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
      maxResults: 20,
    });

    const messages = list.data.messages || [];
    const emails = await Promise.all(
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
          id: m.id,
          sender,
          subject: getHeader('Subject') || '(No subject)',
          receivedAt: getHeader('Date'),
          link: `https://mail.google.com/mail/u/0/#inbox/${m.id}`,
        };
      })
    );

    res.json(emails);
  } catch (err: any) {
    console.error('Gmail error:', err);
    if (err.code === 401) {
      return res.status(401).json({ error: 'Token expired' });
    }
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
}
