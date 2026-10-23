// Keyboard shortcuts. Each command in store/commands.ts names its keys as they are shown ("Ctrl S",
// "Delete / Backspace"), and the same text is what a key press is matched against - so the menus,
// the Help tab and the keys can't drift apart. App listens with handleShortcut.
import { shortcutCommands, type Command } from "./commands";

/** One key with its modifiers, as written in a command's `keys`: "Ctrl Shift Z", "Space", "←". */
export type Chord = { ctrl: boolean; shift: boolean; alt: boolean; key: string };

/** Key names as they are written, to KeyboardEvent.key (lower-cased). Single characters stand for themselves. */
const NAMES: Record<string, string> = {
  space: " ", delete: "delete", backspace: "backspace", home: "home", end: "end", enter: "enter", escape: "escape", esc: "escape",
  "←": "arrowleft", "→": "arrowright", "↑": "arrowup", "↓": "arrowdown",
};

/** The chords a `keys` text stands for: "Ctrl Y / Ctrl Shift Z" is two. */
export function chordsOf(keys: string): Chord[] {
  return keys.split(" / ").map(chord => {
    const parts = chord.trim().split(" ");
    const name = parts.pop()!.toLowerCase();
    const has = (m: string) => parts.some(p => p.toLowerCase() === m);
    return { ctrl: has("ctrl"), shift: has("shift"), alt: has("alt"), key: NAMES[name] ?? name };
  });
}

/**
 * Whether a key press is this chord. Ctrl stands for Cmd on a Mac too. Shift has to match, except for
 * commands that read it themselves (`anyShift`), and except that a chord naming a symbol leaves Shift
 * alone where it takes Shift to type it.
 */
export function pressMatches(chord: Chord, ev: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">, anyShift = false): boolean {
  const ctrl = ev.ctrlKey || ev.metaKey, key = ev.key.toLowerCase();
  const symbol = chord.key.length === 1 && !/[a-z0-9]/.test(chord.key);
  return key === chord.key && ctrl === chord.ctrl && ev.altKey === chord.alt && (anyShift || symbol || ev.shiftKey === chord.shift);
}

/** The command a key press runs, if any - one that applies just now. */
export function commandForPress(ev: KeyboardEvent, commands: Command[] = shortcutCommands()): Command | undefined {
  return commands.find(c => c.keys && (c.shown?.() ?? true) && (c.enabled?.() ?? true)
    && chordsOf(c.keys).some(chord => pressMatches(chord, ev, c.anyShift)));
}

export function handleShortcut(ev: KeyboardEvent): void {
  if (ev.defaultPrevented) return;
  const typing = !!(ev.target as Element).closest?.("input, select, textarea");
  const command = commandForPress(ev);
  if (!command || (typing && !command.whileTyping)) return;
  if (!command.browserDefault) ev.preventDefault();
  void command.run(ev);
}
