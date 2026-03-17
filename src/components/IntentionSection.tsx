import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchIntention, saveIntention } from '../lib/api';
import SkeletonCard from './SkeletonCard';

interface Props {
  date: string;
}

export default function IntentionSection({ date }: Props) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setLoading(true);
    fetchIntention(date)
      .then((data) => setText(data?.text || ''))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [date]);

  const save = useCallback(
    (value: string) => {
      saveIntention(date, value).catch(console.error);
    },
    [date]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setText(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(value), 500);
  };

  const handleBlur = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    save(text);
  };

  if (loading) return <SkeletonCard lines={2} />;

  return (
    <div className="card">
      <div className="card-label">Intention</div>
      <textarea
        className="textarea-input"
        placeholder="How are you going into today?"
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
      />
    </div>
  );
}
