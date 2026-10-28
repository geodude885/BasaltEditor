// Every command, in one table, grouped into File, Edit, View and Playback menus - with the keys that
// run them (store/keyboard.ts matches presses against `keys`). Both layouts draw their menus from
// this: the desktop's menu bar and the phone's menu sheet. Commands say what they do and when they
// apply; the menus only lay them out, and the Help tab lists the keys.
import {
  addMove, addPhase, addProjectile, addStageCueAtPlayhead, copySelected, fit, mirrorSelected, nudge, paste, redo, removeSelected, selectAll, selectBar,
  selectToEnd, undo, zoom,
} from "./actions";
import { doc } from "./document.svelte";
import { SHOT_COLOURINGS } from "../views/shotColours";
import { display } from "./display.svelte";
import { editing } from "./editing.svelte";
import { session } from "./session.svelte";
import { transport } from "./transport.svelte";
import { ui } from "./ui.svelte";
import { copyChart, newChart, openFiles, openFolder, openRecent, save, saveChartAs, savePackage, saveTarget } from "./files";
import { library } from "./library.svelte";
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

const RECENT_SHOWN = 5;

/** What Save does, for its tip and the Help tab, by where it saves (store/files.ts, saveTarget). */
const SAVE_HELP: Record<ReturnType<typeof saveTarget>, string> = {
  folder: "Save into the chart's folder",
  "new-folder": "Save as a new chart folder in the game's Charts folder, among Your charts",
  library: "Save in Your charts, in this browser",
  file: "Save chart.json somewhere you pick",
};

export type MenuId = "file" | "edit" | "view" | "playback";
export type Menu = { id: MenuId; label: string; groups: Command[][] };

const selection = () => editing.selection.size > 0;

/**
 * Starts a new chart. The desktop app asks about unsaved changes in its own dialog; elsewhere the
 * Chart tab asks first.
 */
export function startNewChart(): void {
  library.visible = false;
  if (window.editor.askUnsaved) { void newChart(); return; }
  ui.confirmNew = true;
  ui.revealTab("chart");
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
        // The desktop app's recent chart folders, by folder name.
        session.recentFolders.slice(0, RECENT_SHOWN).map((folder, i): Command => ({
          id: `recent-${i}`, label: `Open recent: ${folder.split(/[\\/]/).filter(Boolean).pop()}`, run: () => openRecent(folder),
          enabled: () => folder !== session.folder,
        })),
        [
          { id: "save", label: saveTarget() === "file" ? "Save chart.json as…" : "Save", keys: "Ctrl S", run: save, whileTyping: true,
            help: SAVE_HELP[saveTarget()] },
          { id: "save-as", label: "Save chart.json as…", keys: "Ctrl Shift S", run: saveChartAs, shown: () => saveTarget() !== "file", whileTyping: true,
            help: "Save a copy of chart.json somewhere you pick" },
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
          { id: "select-none", label: "Select none", keys: "Escape", run: () => editing.selection.clear(), enabled: selection },
        ],
        [
          { id: "add-projectile", label: "Add a projectile", keys: "P", run: () => addProjectile(), help: "Add a projectile at the playhead" },
          { id: "add-move", label: "Add a move", keys: "M", run: addMove, help: "Add a move at the playhead" },
          { id: "add-look", label: "Add a look", run: addStageCueAtPlayhead },
          { id: "add-phase", label: "Start a phase", run: addPhase },
        ],
        [
          { id: "select-mode", label: "Select mode", run: () => { editing.selectMode = !editing.selectMode; }, checked: () => editing.selectMode,
            help: "A drag on empty space draws a selection box" },
          { id: "multi-select", label: "Multi-select", run: () => { editing.multiSelect = !editing.multiSelect; }, checked: () => editing.multiSelect,
            help: "Taps add to the selection, as holding Shift does" },
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
          { id: "view-timeline", label: "Timeline", run: () => { display.mainView = "timeline"; }, checked: () => display.mainView === "timeline" },
          // Its key switches back and forth; a click (no key press) just shows the highway.
          { id: "view-highway", label: "Highway", keys: "H", run: ev => { display.mainView = ev && display.mainView === "highway" ? "timeline" : "highway"; },
            checked: () => display.mainView === "highway", help: "Switch between the timeline and the highway" },
        ],
        [
          { id: "zoom-in", label: "Zoom in", keys: "]", run: () => zoom(1.4), help: "Zoom the timeline in (or Ctrl + scroll)" },
          { id: "zoom-out", label: "Zoom out", keys: "[", run: () => zoom(1 / 1.4) },
          { id: "fit", label: "Fit the chart", run: fit },
        ],
        // Projectile colours: one of these at a time.
        SHOT_COLOURINGS.map(([colouring, label]): Command => ({
          id: `shot-colours-${colouring}`, label: `Projectiles: ${label.toLowerCase()}`, run: () => display.colourShotsBy(colouring),
          checked: () => display.shotColouring === colouring,
        })),
        [
          { id: "look-preview", label: "Look preview", keys: "K", run: () => display.toggleLookPreview(), checked: () => display.lookPreview,
            help: "Show or hide the look preview" },
        ],
      ],
    },
    {
      id: "playback", label: "Playback", groups: [
        [
          { id: "play", label: transport.playing ? "Pause" : "Play", keys: "Space", run: playOrPause, help: "Play / pause" },
          { id: "to-start", label: "Back to the start", keys: "Home", run: () => seek(0) },
          { id: "last-play", label: "Back to where playing started", keys: ".", run: backToPlayStart },
          { id: "back-bar", label: "Back a bar", keys: ",", run: () => rewindBars(1) },
          { id: "back-5s", label: "Back 5 seconds", run: () => rewindSeconds(5) },
        ],
        [
          { id: "record", label: "Record taps", keys: "R", run: () => recording.toggle(),
            checked: () => recording.armed, help: "Arm tap-along recording on the highway; play, then tap the columns' pads or keys" },
          { id: "record-replace", label: "Takes replace what's there", run: () => { recording.mode = recording.mode === "replace" ? "add" : "replace"; },
            checked: () => recording.mode === "replace", shown: () => recording.armed },
        ],
        [
          { id: "loop", label: loopPointLabel(), keys: "L", run: loopPoint, checked: () => !!practice.loop,
            help: "Set the loop's start, then its end; again to clear it" },
          { id: "preroll", label: "Pre-roll a bar", run: () => { practice.preroll = !practice.preroll; }, checked: () => practice.preroll,
            help: "Start playing a bar early, to hear the music lead in" },
          { id: "click", label: "Beat click", run: () => { transport.click = !transport.click; ensureAudio(); }, checked: () => transport.click },
        ],
      ],
    },
  ];
  return base;
}

/** One command, by its id - for a button that runs it outside the menus. */
export function command(id: string): Command {
  const found = [...menus().flatMap(m => m.groups.flat()), ...keysOnly()].find(c => c.id === id);
  if (!found) throw new Error(`no command "${id}"`);
  return found;
}

/**
 * What a button for a command needs, to spread onto it (`<button {...commandButton("delete")}>Delete</button>`):
 * it runs the command, greys out where the command doesn't apply, shows a setting as pressed, and
 * says what it does and its keys. The button's text is its own, so it can be shorter than the menu's.
 */
export function commandButton(id: string): { onclick: () => void; disabled: boolean; "aria-pressed"?: boolean; title: string } {
  const c = command(id);
  return {
    onclick: () => void c.run(),
    disabled: c.enabled ? !c.enabled() : false,
    "aria-pressed": c.checked?.(),
    title: `${c.help ?? c.label}${c.keys ? ` (${c.keys})` : ""}`,
  };
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
