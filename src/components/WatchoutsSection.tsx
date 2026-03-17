import { useState, useEffect } from 'react';
import {
  fetchWatchouts,
  addWatchout,
  deleteWatchout,
  type WatchoutItem,
} from '../lib/api';
import SkeletonCard from './SkeletonCard';

interface Props {
  date: string;
}

export default function WatchoutsSection({ date }: Props) {
  const [items, setItems] = useState<WatchoutItem[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchWatchouts(date)
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [date]);

  const handleAdd = async (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || !input.trim()) return;
    const text = input.trim();
    setInput('');
    try {
      const item = await addWatchout(text, date);
      setItems((prev) => [...prev, item]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    setItems((prev) => prev.filter((w) => w._id !== id));
    try {
      await deleteWatchout(id);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <SkeletonCard lines={3} />;

  return (
    <div className="card">
      <div className="card-label">Watchouts</div>

      {items.length === 0 && <div className="empty-state">Nothing to watch for today</div>}

      {items.map((item) => (
        <div className="list-item" key={item._id}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.5rem' }}>●</span>
          <span className="list-item-text">{item.text}</span>
          <button className="delete-btn" onClick={() => handleDelete(item._id)}>
            ×
          </button>
        </div>
      ))}

      <input
        className="inline-input"
        placeholder="Add a watchout…"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleAdd}
        style={{ marginTop: items.length > 0 ? 12 : 0 }}
      />
    </div>
  );
}
