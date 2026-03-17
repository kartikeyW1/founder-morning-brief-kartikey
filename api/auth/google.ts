import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOAuth2Client, SCOPES } from '../_lib/google.js';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const oauth2 = getOAuth2Client();
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
  res.redirect(url);
}
