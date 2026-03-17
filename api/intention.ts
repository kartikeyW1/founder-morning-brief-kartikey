import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from './_lib/db.js';
import { Intention } from './_lib/models.js';
import { getSession } from './_lib/session.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!getSession(req)) return res.status(401).json({ error: 'Not authenticated' });

  await connectDB();

  if (req.method === 'GET') {
    const date = req.query.date as string;
    if (!date) return res.status(400).json({ error: 'date required' });
    const item = await Intention.findOne({ userId: 'pushkar', date });
    return res.json(item || null);
  }

  if (req.method === 'PUT') {
    const { date, text } = req.body;
    if (!date) return res.status(400).json({ error: 'date required' });
    const item = await Intention.findOneAndUpdate(
      { userId: 'pushkar', date },
      { text, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    return res.json(item);
  }

  res.status(405).json({ error: 'Method not allowed' });
}
