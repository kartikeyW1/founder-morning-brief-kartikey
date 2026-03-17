import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { getOAuth2Client } from '../_lib/google.js';
import { GoogleToken } from '../_lib/models.js';
import { connectDB } from '../_lib/db.js';
import { setSession } from '../_lib/session.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = req.query.code as string;
  if (!code) return res.status(400).json({ error: 'Missing code' });

  try {
    await connectDB();
    const oauth2 = getOAuth2Client();
    const { tokens } = await oauth2.getToken(code);

    oauth2.setCredentials(tokens);

    // Fetch user profile to get their name
    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 });
    const { data: profile } = await oauth2Api.userinfo.get();
    const name = profile.given_name || profile.name || '';

    await GoogleToken.findOneAndUpdate(
      { userId: 'pushkar' },
      {
        userId: 'pushkar',
        displayName: name,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(tokens.expiry_date!),
      },
      { upsert: true, new: true }
    );

    setSession(res, 'pushkar', name);
    res.redirect('/');
  } catch (err: any) {
    console.error('OAuth callback error:', err);
    res.status(500).json({ error: 'OAuth failed' });
  }
}
