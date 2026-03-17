import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Import handlers
import authGoogle from './api/auth/google.js';
import authCallback from './api/auth/callback.js';
import calendar from './api/calendar.js';
import emails from './api/emails.js';
import priorities from './api/priorities.js';
import watchouts from './api/watchouts.js';
import intention from './api/intention.js';
import me from './api/me.js';
import authLogout from './api/auth/logout.js';
import morningBrief from './api/cron/morning-brief.js';

const app = express();
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Adapt Vercel handler to Express
// Express v5 makes req.query a getter, so we wrap with a proxy
function adapt(handler: any) {
  return async (req: any, res: any) => {
    const vercelReq = Object.create(req, {
      query: {
        value: { ...req.query, ...req.params },
        writable: true,
        enumerable: true,
      },
      body: {
        value: req.body,
        writable: true,
        enumerable: true,
      },
      headers: {
        value: req.headers,
        enumerable: true,
      },
      method: {
        value: req.method,
        enumerable: true,
      },
    });
    try {
      await handler(vercelReq, res);
    } catch (err: any) {
      console.error(`Error in ${req.method} ${req.path}:`, err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    }
  };
}

app.get('/api/auth/google', adapt(authGoogle));
app.get('/api/auth/callback', adapt(authCallback));
app.get('/api/me', adapt(me));
app.get('/api/auth/logout', adapt(authLogout));
app.get('/api/calendar', adapt(calendar));
app.get('/api/emails', adapt(emails));

app.get('/api/priorities', adapt(priorities));
app.post('/api/priorities', adapt(priorities));
app.patch('/api/priorities', adapt(priorities));
app.delete('/api/priorities', adapt(priorities));

app.get('/api/watchouts', adapt(watchouts));
app.post('/api/watchouts', adapt(watchouts));
app.delete('/api/watchouts', adapt(watchouts));

app.get('/api/intention', adapt(intention));
app.put('/api/intention', adapt(intention));

app.get('/api/cron/morning-brief', adapt(morningBrief));

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
