import jwt from 'jsonwebtoken';
import { parse, serialize } from 'cookie';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const COOKIE_NAME = 'mb_session';

export function setSession(res: VercelResponse, userId: string, name?: string) {
  const token = jwt.sign({ userId, name: name || '' }, process.env.SESSION_SECRET!, { expiresIn: '30d' });
  res.setHeader(
    'Set-Cookie',
    serialize(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    })
  );
}

export function getSession(req: VercelRequest): string | null {
  const cookies = parse(req.headers.cookie || '');
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.SESSION_SECRET!) as { userId: string; name?: string };
    return decoded.userId;
  } catch {
    return null;
  }
}

export function getSessionData(req: VercelRequest): { userId: string; name: string } | null {
  const cookies = parse(req.headers.cookie || '');
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.SESSION_SECRET!) as { userId: string; name?: string };
    return { userId: decoded.userId, name: decoded.name || '' };
  } catch {
    return null;
  }
}
