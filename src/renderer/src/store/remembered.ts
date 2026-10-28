// Settings the editor remembers in this browser (or the desktop app's), not in the chart: read once at
// start-up, written when they change. Storage can be missing or full; then they just aren't kept.

/** The remembered value, or `fallback` when there is none (or it doesn't pass `valid`). */
export function remembered<T>(key: string, fallback: T, read: (text: string) => T | undefined): T {
  try {
    const text = localStorage.getItem(key);
    if (text !== null) { const value = read(text); if (value !== undefined) return value; }
  } catch { /* not kept */ }
  return fallback;
}

export function remember(key: string, text: string): void {
  try { localStorage.setItem(key, text); } catch { /* not kept */ }
}
