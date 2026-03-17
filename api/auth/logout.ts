import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serialize } from 'cookie';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader(
    'Set-Cookie',
    serialize('mb_session', '', {
      httpOnly: true,
      path: '/',
      maxAge: 0,
    })
  );
  res.redirect('/');
}
