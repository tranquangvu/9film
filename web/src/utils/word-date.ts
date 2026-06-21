// SQLite stamps are UTC "YYYY-MM-DD HH:MM:SS"; optimistic stamps are ISO. Parse
// both so saved-word timestamps can be bucketed by the viewer's local day.
export function parseDate(s?: string): Date | null {
  if (!s) return null;
  const norm = s.includes('T') ? s : s.replace(' ', 'T') + 'Z';
  const d = new Date(norm);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
