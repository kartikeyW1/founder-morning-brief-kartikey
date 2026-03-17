export function formatTimeIST(iso: string): string {
  if (!iso || iso.length === 10) return 'All day';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}
