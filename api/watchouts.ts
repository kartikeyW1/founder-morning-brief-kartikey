import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from './_lib/db.js';
import { Watchout } from './_lib/models.js';
import { getSession } from './_lib/session.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!getSession(req)) return res.status(401).json({ error: 'Not authenticated' });

  await connectDB();

  if (req.method === 'GET') {
    const date = req.query.date as string;
    if (!date) return res.status(400).json({ error: 'date required' });
    const items = await Watchout.find({ userId: 'pushkar', date }).sort({ createdAt: 1 });
    return res.json(items);
  }

  if (req.method === 'POST') {
    const { text, date } = req.body;
    if (!text || !date) return res.status(400).json({ error: 'text and date required' });
    const item = await Watchout.create({ userId: 'pushkar', date, text });
    return res.status(201).json(item);
  }

  if (req.method === 'DELETE') {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: 'id required' });
    await Watchout.findByIdAndDelete(id);
    return res.json({ ok: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
