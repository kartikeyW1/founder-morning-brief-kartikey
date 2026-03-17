import { useState, useEffect } from 'react';
import { getToday, formatDate, getGreeting } from './lib/dateUtils';
import PrioritiesSection from './components/PrioritiesSection';
import MeetingsSection from './components/MeetingsSection';
import EmailSection from './components/EmailSection';

export default function App() {
  const [today] = useState(getToday());
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    fetch('/api/me')
      .then((res) => {
        if (!res.ok) {
          setAuthenticated(false);
          return;
        }
        setAuthenticated(true);
        return res.json();
      })
      .then((data) => {
        if (data?.name) setUserName(data.name);
      })
      .catch(() => setAuthenticated(false));
  }, []);

  if (authenticated === null) {
    return (
      <div className="auth-screen">
        <div className="skeleton" style={{ width: 200, height: 20 }} />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="auth-screen">
        <div className="auth-title">Morning Brief</div>
        <div className="auth-subtitle">
          Connect your Google account to see your calendar and emails
        </div>
        <a href="/api/auth/google" className="auth-btn">
          Connect Google
        </a>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-left">
          <div className="header-date">{formatDate(new Date())}</div>
          <h1 className="header-greeting">{getGreeting(userName)}</h1>
        </div>
        <a href="/api/auth/logout" className="logout-btn" title="Log out">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </a>
      </header>

      <div className="bento">
        <div className="bento-priorities">
          <PrioritiesSection date={today} />
        </div>
        <div className="bento-meetings">
          <MeetingsSection />
        </div>
        <div className="bento-emails">
          <EmailSection />
        </div>
      </div>
    </div>
  );
}
