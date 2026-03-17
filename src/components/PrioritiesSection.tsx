import { useState, useEffect } from 'react';
import {
  fetchPriorities,
  addPriority,
  togglePriority,
  deletePriority,
  type PriorityItem,
} from '../lib/api';
import SkeletonCard from './SkeletonCard';

interface Props {
  date: string;
}

export default function PrioritiesSection({ date }: Props) {
  const [items, setItems] = useState<PriorityItem[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchPriorities(date)
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [date]);

  const handleAdd = async (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || !input.trim()) return;
    const text = input.trim();
    setInput('');
    try {
      const item = await addPriority(text, date);
      setItems((prev) => [...prev, item]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggle = async (item: PriorityItem) => {
    const newDone = !item.done;
    setItems((prev) =>
      prev.map((p) => (p._id === item._id ? { ...p, done: newDone } : p))
    );
    try {
      await togglePriority(item._id, newDone);
    } catch (err) {
      setItems((prev) =>
        prev.map((p) => (p._id === item._id ? { ...p, done: !newDone } : p))
      );
    }
  };

  const handleDelete = async (id: string) => {
    setItems((prev) => prev.filter((p) => p._id !== id));
    try {
      await deletePriority(id);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <SkeletonCard lines={4} />;

  return (
    <div className="card card-scroll-layout">
      <div className="card-label">
        Priorities
        {items.length > 0 && <span className="card-count">{items.filter(i => !i.done).length} remaining</span>}
      </div>

      <div className="card-scroll-area">
        {items.length === 0 && <div className="empty-state">No priorities yet</div>}

        {items.map((item) => (
          <div className="list-item" key={item._id}>
            <div
              className={`checkbox ${item.done ? 'checked' : ''}`}
              onClick={() => handleToggle(item)}
            />
            <span className={`list-item-text ${item.done ? 'done' : ''}`}>
              {item.text}
            </span>
            {item.carriedOver && <span className="badge">from yesterday</span>}
            <button className="delete-btn" onClick={() => handleDelete(item._id)}>
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="card-scroll-footer">
        <input
          className="inline-input"
          placeholder="Add a priority…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleAdd}
        />
      </div>
    </div>
  );
}
