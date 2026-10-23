// Every command, in one table, grouped into File, Edit, View and Playback menus - with the keys that
// run them (store/keyboard.ts matches presses against `keys`). Both layouts draw their menus from
// this: the desktop's menu bar and the phone's menu sheet. Commands say what they do and when they
// apply; the menus only lay them out, and the Help tab lists the keys.
import {
  addMove, addPhase, addProjectile, addStageCueAtPlayhead, copySelected, fit, mirrorSelected, nudge, paste, redo, removeSelected, selectAll, selectBar,
  selectToEnd, undo, zoom,
} from "./actions";
import { doc } from "./document.svelte";
import { editor } from "./editor.svelte";
import { copyChart, openFiles, openFolder, save, saveChartAs, savePackage } from "./files";
import { layout } from "./layout.svelte";
import { library } from "./library.svelte";
import { mobile } from "./mobile.svelte";
import { ensureAudio, seek } from "./playback";
import { recording } from "./recording.svelte";
import { backToPlayStart, loopPoint, loopPointLabel, playOrPause, practice, rewindBars, rewindSeconds, selectLoop } from "./practice.svelte";

export type Command = {
  id: string;
  label: string;
  /** The keys that run it, as shown - and as matched: "Ctrl S", "Delete / Backspace" (see keyboard.ts). */
  keys?: string;
  /** What the Help tab says it does, when the label isn't enough. */
  help?: string;
  run: (ev?: KeyboardEvent) => unknown;
  /** Greyed out when false - and its keys do nothing. */
  enabled?: () => boolean;
  /** Left out of the menu when false - for commands one platform can't do. */
  shown?: () => boolean;
  /** Ticked when true, for settings. */
  checked?: () => boolean;
  /** Its keys work in a text box too. */
  whileTyping?: boolean;
  /** Its keys still do what the browser does as well (Ctrl C copies text that is selected). */
  browserDefault?: boolean;
  /** It reads Shift itself, so its keys match with or without. */
  anyShift?: boolean;
};

export type MenuId = "file" | "edit" | "view" | "playback";
export type Menu = { id: MenuId; label: string; groups: Command[][] };

const selection = () => editor.selection.size > 0;

/** Asks whether to start a new chart, where the Chart tab shows the question. */
export function startNewChart(): void {
  library.visible = false;
  editor.confirmNew = true;
  editor.tab = "chart";
  if (layout.compact) { mobile.menu = false; mobile.drawer = "chart"; }
}

/**
 * Places can add their own commands to a menu (a layout adds its editors to View) without this table
 * knowing about them.
 */
const extra: Partial<Record<MenuId, Command[][]>> = {};
export function addToMenu(menu: MenuId, group: Command[]): void {
  (extra[menu] ??= []).push(group);
}

/** Whether the open-folder dialog exists here; set by the platform at start-up. */
export const platform = { canOpenFolders: true };

export function menus(): Menu[] {
  const base: Menu[] = [
    {
      id: "file", label: "File", groups: [
        [
          { id: "new", label: "New chart", run: startNewChart },
          { id: "library", label: "Your charts…", run: () => library.show(), shown: () => library.available },
        ],
        [
          { id: "open", label: "Open files…", keys: "Ctrl O", run: openFiles, whileTyping: true },
          { id: "open-folder", label: "Open folder…", run: openFolder, shown: () => platform.canOpenFolders },
        ],
        [
          { id: "save", label: editor.folder ? "Save" : "Save as…", keys: "Ctrl S", run: save, whileTyping: true,
            help: "Save into the open chart folder (else save chart.json as…)" },
          { id: "save-as", label: "Save as…", keys: "Ctrl Shift S", run: saveChartAs, shown: () => !!editor.folder, whileTyping: true },
          { id: "package", label: "Package (.bbchart)…", run: savePackage },
          { id: "copy-chart", label: "Copy chart.json", run: copyChart },
        ],
      ],
    },
    {
      id: "edit", label: "Edit", groups: [
        [
          { id: "undo", label: "Undo", keys: "Ctrl Z", run: undo, enabled: () => doc.canUndo },
          { id: "redo", label: "Redo", keys: "Ctrl Y / Ctrl Shift Z", run: redo, enabled: () => doc.canRedo },
        ],
        [
          { id: "copy", label: "Copy", keys: "Ctrl C", run: copySelected, enabled: selection, browserDefault: true, help: "Copy the selection" },
          { id: "paste", label: "Paste at the playhead", keys: "Ctrl V", run: paste, browserDefault: true },
          { id: "mirror", label: "Mirror", keys: "X", run: mirrorSelected, enabled: selection, help: "Mirror the selection left/right" },
          { id: "delete", label: "Delete", keys: "Delete / Backspace", run: removeSelected, enabled: selection, help: "Delete the selection" },
          { id: "select-none", label: "Select none", keys: "Escape", run: () => editor.selection.clear(), enabled: selection },
        ],
        [
          { id: "add-projectile", label: "Add a projectile", keys: "P", run: () => addProjectile(), help: "Add a projectile at the playhead" },
          { id: "add-move", label: "Add a move", keys: "M", run: addMove, help: "Add a move at the playhead" },
          { id: "add-look", label: "Add a look", run: addStageCueAtPlayhead },
          { id: "add-phase", label: "Start a phase", run: addPhase },
        ],
        [
          { id: "select-mode", label: "Select mode", run: () => { editor.selectMode = !editor.selectMode; }, checked: () => editor.selectMode,
            help: "A drag on empty space draws a selection box" },
          { id: "select-bar", label: "Select this bar", run: selectBar },
          { id: "select-loop", label: "Select the loop", run: selectLoop, shown: () => !!practice.loop },
          { id: "select-to-end", label: "Select to the end", run: selectToEnd },
          { id: "select-all", label: "Select all projectiles", keys: "Ctrl A", run: selectAll },
        ],
      ],
    },
    {
      id: "view", label: "View", groups: [
        [
          { id: "view-timeline", label: "Timeline", run: () => { editor.mainView = "timeline"; }, checked: () => editor.mainView === "timeline" },
          { id: "view-highway", label: "Highway", keys: "H", run: () => { editor.mainView = editor.mainView === "highway" ? "timeline" : "highway"; },
            checked: () => editor.mainView === "highway", help: "Switch between the highway and the timeline" },
        ],
        [
          { id: "zoom-in", label: "Zoom in", keys: "]", run: () => zoom(1.4), help: "Zoom the timeline in (or Ctrl + scroll)" },
          { id: "zoom-out", label: "Zoom out", keys: "[", run: () => zoom(1 / 1.4) },
          { id: "fit", label: "Fit the chart", run: fit },
        ],
      ],
    },
    {
      id: "playback", label: "Playback", groups: [
        [
          { id: "play", label: editor.playing ? "Pause" : "Play", keys: "Space", run: playOrPause, help: "Play / pause" },
          { id: "to-start", label: "Back to the start", keys: "Home", run: () => seek(0) },
          { id: "last-play", label: "Back to where playing started", keys: ".", run: backToPlayStart },
          { id: "back-bar", label: "Back a bar", keys: ",", run: () => rewindBars(1) },
          { id: "back-5s", label: "Back 5 seconds", run: () => rewindSeconds(5) },
        ],
        [
          { id: "record", label: "Record taps", keys: "R", run: () => { recording.finish(); recording.armed = !recording.armed; if (recording.armed) editor.mainView = "highway"; },
            checked: () => recording.armed, help: "Arm tap-along recording on the highway; play, then tap 1 to 5 for the columns" },
          { id: "record-replace", label: "Takes replace what's there", run: () => { recording.mode = recording.mode === "replace" ? "add" : "replace"; },
            checked: () => recording.mode === "replace", shown: () => recording.armed },
        ],
        [
          { id: "loop", label: loopPointLabel(), keys: "L", run: loopPoint, checked: () => !!practice.loop,
            help: "Set the loop's start, then its end; again to clear it" },
          { id: "preroll", label: "Pre-roll a bar", run: () => { practice.preroll = !practice.preroll; }, checked: () => practice.preroll,
            help: "Start playing a bar early, to hear the music lead in" },
          { id: "click", label: "Beat click", run: () => { editor.click = !editor.click; ensureAudio(); }, checked: () => editor.click },
        ],
      ],
    },
  ];
  for (const menu of base) menu.groups.push(...(extra[menu.id] ?? []));
  return base;
}

/** Commands with keys but no place in a menu. */
function keysOnly(): Command[] {
  return [
    { id: "nudge-left", label: "Nudge left", keys: "←", run: ev => nudge(-1, !!ev?.shiftKey), anyShift: true,
      help: "Move the selection back by the snap (Shift: by a bar); with nothing selected, move the playhead" },
    { id: "nudge-right", label: "Nudge right", keys: "→", run: ev => nudge(1, !!ev?.shiftKey), anyShift: true,
      help: "Move the selection on by the snap (Shift: by a bar); with nothing selected, move the playhead" },
  ];
}

/** Every command that has keys, menus first - what a key press is looked up in, and the Help tab lists. */
export function shortcutCommands(): Command[] {
  return [...menus().flatMap(m => m.groups.flat()), ...keysOnly()].filter(c => c.keys);
}

/** The commands of a menu worth drawing: shown ones, in groups that still have any. */
export const visibleGroups = (menu: Menu): Command[][] =>
  menu.groups.map(group => group.filter(c => c.shown?.() ?? true)).filter(group => group.length);
