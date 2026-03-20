import { OAuth2Client } from 'google-auth-library';
import { GoogleToken } from './models.js';
import { connectDB } from './db.js';

export function getOAuth2Client() {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export async function getAuthedClient() {
  await connectDB();
  const token = await GoogleToken.findOne({ userId: 'pushkar' });
  if (!token) return null;

  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
    expiry_date: token.expiresAt.getTime(),
  });

  // Auto-refresh if expired
  if (token.expiresAt.getTime() < Date.now()) {
    const { credentials } = await oauth2.refreshAccessToken();
    await GoogleToken.updateOne(
      { userId: 'pushkar' },
      {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token || token.refreshToken,
        expiresAt: new Date(credentials.expiry_date!),
      }
    );
    oauth2.setCredentials(credentials);
  }

  return oauth2;
}

export async function getAuthedClientWithProfile() {
  await connectDB();
  const token = await GoogleToken.findOne({ userId: 'pushkar' });
  if (!token) return null;

  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
    expiry_date: token.expiresAt.getTime(),
  });

  if (token.expiresAt.getTime() < Date.now()) {
    const { credentials } = await oauth2.refreshAccessToken();
    await GoogleToken.updateOne(
      { userId: 'pushkar' },
      {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token || token.refreshToken,
        expiresAt: new Date(credentials.expiry_date!),
      }
    );
    oauth2.setCredentials(credentials);
  }

  return { auth: oauth2, displayName: token.displayName || '' };
}

export const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
];
