// Every keyboard shortcut, in one table: App listens with handleShortcut, the Help tab lists them.
import { addMove, addProjectile, copySelected, mirrorSelected, nudge, paste, redo, removeSelected, undo, zoom } from "./actions";
import { openFiles, save } from "./files";
import { play, seek } from "./playback";

export type Shortcut = {
  keysShown: string;
  description: string;
  matches: (ev: KeyboardEvent, ctrl: boolean, key: string) => boolean;
  run: (ev: KeyboardEvent) => void;
  worksWhileTyping?: boolean;
  keepsBrowserDefault?: boolean;
};

export const SHORTCUTS: Shortcut[] = [
  { keysShown: "Space", description: "Play / pause", matches: (_, ctrl, key) => !ctrl && key === " ", run: play },
  { keysShown: "Home", description: "Back to the start", matches: (_, ctrl, key) => !ctrl && key === "home", run: () => seek(0) },
  { keysShown: "P", description: "Add a projectile at the playhead", matches: (_, ctrl, key) => !ctrl && key === "p", run: () => addProjectile() },
  { keysShown: "M", description: "Add a move at the playhead", matches: (_, ctrl, key) => !ctrl && key === "m", run: addMove },
  { keysShown: "Delete", description: "Delete the selection", matches: (_, ctrl, key) => !ctrl && (key === "delete" || key === "backspace"), run: removeSelected },
  { keysShown: "X", description: "Mirror the selection left/right", matches: (_, ctrl, key) => !ctrl && key === "x", run: mirrorSelected },
  { keysShown: "Ctrl C / V", description: "Copy the selection / paste it at the playhead", matches: (_, ctrl, key) => ctrl && (key === "c" || key === "v"),
    run: ev => (ev.key.toLowerCase() === "c" ? copySelected : paste)(), keepsBrowserDefault: true },
  { keysShown: "← →", description: "Move the selection by the snap (Shift: by a bar); with nothing selected, move the playhead",
    matches: (_, ctrl, key) => !ctrl && (key === "arrowleft" || key === "arrowright"), run: ev => nudge(ev.key === "ArrowLeft" ? -1 : 1, ev.shiftKey) },
  { keysShown: "Ctrl Z / Y", description: "Undo / redo (Ctrl Shift Z redoes too)", matches: (_, ctrl, key) => ctrl && (key === "z" || key === "y"),
    run: ev => (ev.key.toLowerCase() === "y" || ev.shiftKey ? redo : undo)() },
  { keysShown: "[ ]", description: "Zoom the timeline (or Ctrl + scroll)", matches: (_, ctrl, key) => !ctrl && (key === "[" || key === "]"),
    run: ev => zoom(ev.key === "]" ? 1.4 : 1 / 1.4) },
  { keysShown: "Ctrl S", description: "Save into the open chart folder (else save chart.json as…)", matches: (_, ctrl, key) => ctrl && key === "s",
    run: () => void save(), worksWhileTyping: true },
  { keysShown: "Ctrl O", description: "Open chart files", matches: (_, ctrl, key) => ctrl && key === "o", run: () => void openFiles(), worksWhileTyping: true },
];

export function handleShortcut(ev: KeyboardEvent): void {
  const ctrl = ev.ctrlKey || ev.metaKey, key = ev.key.toLowerCase();
  const typing = !!(ev.target as Element).closest?.("input, select, textarea");
  const shortcut = SHORTCUTS.find(s => s.matches(ev, ctrl, key) && (!typing || s.worksWhileTyping));
  if (!shortcut) return;
  if (!shortcut.keepsBrowserDefault) ev.preventDefault();
  shortcut.run(ev);
}
