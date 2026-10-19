// Basalt Editor used to be the Boss Battles Chart Editor. What it remembered under the old names moves
// to the new ones, once. main.ts imports this before anything that reads them.
// The desktop app moves the storage itself across first (src/main/index.ts).

const RENAMED: Record<string, string> = {
  "bb-editor-draft": "basalt-draft",
  "bb-editor-volume": "basalt-volume",
  "bb-editor-collapsed-timeline-rows": "basalt-collapsed-timeline-rows",
  "bb-editor-extra-timeline-height": "basalt-extra-timeline-height",
};

try {
  for (const [old, now] of Object.entries(RENAMED)) {
    const value = localStorage.getItem(old);
    if (value === null) continue;
    if (localStorage.getItem(now) === null) localStorage.setItem(now, value);
    localStorage.removeItem(old);
  }
} catch { /* no storage: nothing to move */ }
