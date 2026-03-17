import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from './_lib/db.js';
import { Priority } from './_lib/models.js';
import { getSession } from './_lib/session.js';

function getYesterday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!getSession(req)) return res.status(401).json({ error: 'Not authenticated' });

  await connectDB();

  if (req.method === 'GET') {
    const date = req.query.date as string;
    if (!date) return res.status(400).json({ error: 'date required' });

    const yesterday = getYesterday(date);

    const [todayItems, carriedOver] = await Promise.all([
      Priority.find({ userId: 'pushkar', date }).sort({ createdAt: 1 }),
      Priority.find({ userId: 'pushkar', date: yesterday, done: false }).sort({ createdAt: 1 }),
    ]);

    const carried = carriedOver.map((item: any) => ({
      _id: item._id,
      text: item.text,
      done: item.done,
      carriedOver: true,
      date: item.date,
      createdAt: item.createdAt,
    }));

    return res.json([...carried, ...todayItems]);
  }

  if (req.method === 'POST') {
    const { text, date } = req.body;
    if (!text) return res.status(400).json({ error: 'text required' });
    const today = date || new Date().toISOString().split('T')[0];
    const item = await Priority.create({ userId: 'pushkar', date: today, text });
    return res.status(201).json(item);
  }

  if (req.method === 'PATCH') {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: 'id required' });
    const item = await Priority.findByIdAndUpdate(id, { done: req.body.done }, { new: true });
    if (!item) return res.status(404).json({ error: 'Not found' });
    return res.json(item);
  }

  if (req.method === 'DELETE') {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: 'id required' });
    await Priority.findByIdAndDelete(id);
    return res.json({ ok: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
