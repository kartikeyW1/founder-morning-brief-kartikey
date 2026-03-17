import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSessionData } from './_lib/session.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const session = getSessionData(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ name: session.name });
}
