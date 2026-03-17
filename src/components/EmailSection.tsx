import { useState, useEffect } from 'react';
import { fetchEmails, type EmailItem } from '../lib/api';
import { formatEmailTime } from '../lib/dateUtils';
import SkeletonCard from './SkeletonCard';

export default function EmailSection() {
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmails()
      .then(setEmails)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonCard lines={5} />;

  return (
    <div className="card card-scroll-layout">
      <div className="card-label">
        Unread Emails
        {emails.length > 0 && <span className="card-count">{emails.length} unread</span>}
      </div>

      <div className="card-scroll-area">
        {emails.length === 0 && <div className="empty-state">No unread emails</div>}

        {emails.map((email) => (
          <a
            className="email-row"
            key={email.id}
            href={email.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="email-sender">{email.sender}</span>
            <span className="email-subject">{email.subject}</span>
            <span className="email-time">{formatEmailTime(email.receivedAt)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
