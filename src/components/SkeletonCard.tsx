export default function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card">
      <div className="skeleton skeleton-line" style={{ width: '30%', height: 10, marginBottom: 16 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton skeleton-line"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
}
