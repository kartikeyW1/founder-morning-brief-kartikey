const BASE = '/api';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (res.status === 401) {
    window.location.href = '/api/auth/google';
    throw new Error('Not authenticated');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Calendar
export interface CalendarEvent {
  id: string;
  time: string;
  endTime: string;
  title: string;
  location: string;
  meetLink: string;
  isNext: boolean;
}

export function fetchCalendar(): Promise<CalendarEvent[]> {
  return fetchJSON(`${BASE}/calendar`);
}

// Emails
export interface EmailItem {
  id: string;
  sender: string;
  subject: string;
  receivedAt: string;
  link: string;
}

export function fetchEmails(): Promise<EmailItem[]> {
  return fetchJSON(`${BASE}/emails`);
}

// Priorities
export interface PriorityItem {
  _id: string;
  text: string;
  done: boolean;
  carriedOver: boolean;
  date: string;
  createdAt: string;
}

export function fetchPriorities(date: string): Promise<PriorityItem[]> {
  return fetchJSON(`${BASE}/priorities?date=${date}`);
}

export function addPriority(text: string, date: string): Promise<PriorityItem> {
  return fetchJSON(`${BASE}/priorities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, date }),
  });
}

export function togglePriority(id: string, done: boolean): Promise<PriorityItem> {
  return fetchJSON(`${BASE}/priorities?id=${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ done }),
  });
}

export function deletePriority(id: string): Promise<{ ok: boolean }> {
  return fetchJSON(`${BASE}/priorities?id=${id}`, { method: 'DELETE' });
}

// Watchouts
export interface WatchoutItem {
  _id: string;
  text: string;
  date: string;
  createdAt: string;
}

export function fetchWatchouts(date: string): Promise<WatchoutItem[]> {
  return fetchJSON(`${BASE}/watchouts?date=${date}`);
}

export function addWatchout(text: string, date: string): Promise<WatchoutItem> {
  return fetchJSON(`${BASE}/watchouts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, date }),
  });
}

export function deleteWatchout(id: string): Promise<{ ok: boolean }> {
  return fetchJSON(`${BASE}/watchouts?id=${id}`, { method: 'DELETE' });
}

// Intention
export interface IntentionData {
  _id: string;
  text: string;
  date: string;
}

export function fetchIntention(date: string): Promise<IntentionData | null> {
  return fetchJSON(`${BASE}/intention?date=${date}`);
}

export function saveIntention(date: string, text: string): Promise<IntentionData> {
  return fetchJSON(`${BASE}/intention`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, text }),
  });
}
