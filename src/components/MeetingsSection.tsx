import { useState, useEffect } from 'react';
import { fetchCalendar, type CalendarEvent } from '../lib/api';
import { formatTime } from '../lib/dateUtils';
import SkeletonCard from './SkeletonCard';

export default function MeetingsSection() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCalendar()
      .then(setEvents)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonCard lines={5} />;

  return (
    <div className="card">
      <div className="card-label">
        Meetings
        {events.length > 0 && <span className="card-count">{events.length} today</span>}
      </div>

      {events.length === 0 && <div className="empty-state">No meetings today</div>}

      {events.map((event) => (
        <div
          key={event.id}
          className={`meeting-card ${event.isNext ? 'is-next' : ''}`}
        >
          <div className="meeting-time">
            {formatTime(event.time)} – {formatTime(event.endTime)}
          </div>
          <div className="meeting-title">{event.title}</div>
          {event.location && (
            <div className="meeting-location">{event.location}</div>
          )}
          {event.meetLink && (
            <a
              href={event.meetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="join-btn"
            >
              Join
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
