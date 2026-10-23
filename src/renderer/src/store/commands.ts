// Every menu command, in one table, grouped into File, Edit and View menus. A menu is drawn from
// this, whichever layout draws it: the phone's menu sheet now, and a desktop menu bar later (in the
// page, or as the app's native menu over IPC). Commands say what they do and when they apply; the
// menus only lay them out.
import { copySelected, fit, mirrorSelected, paste, redo, removeSelected, selectAll, selectBar, selectToEnd, undo, zoom } from "./actions";
import { doc } from "./document.svelte";
import { editor } from "./editor.svelte";
import { copyChart, openFiles, openFolder, save, saveChartAs, savePackage } from "./files";
import { layout } from "./layout.svelte";
import { library } from "./library.svelte";
import { mobile } from "./mobile.svelte";
import { practice, selectLoop } from "./practice.svelte";

export type Command = {
  id: string;
  label: string;
  /** The keys that do it, as the Help tab shows them; the shortcuts themselves are in keyboard.ts. */
  keys?: string;
  run: () => unknown;
  /** Greyed out when false. */
  enabled?: () => boolean;
  /** Left out of the menu when false - for commands one platform can't do. */
  shown?: () => boolean;
  /** Ticked when true, for settings. */
  checked?: () => boolean;
};

export type MenuId = "file" | "edit" | "view";
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
 * Places can add their own commands to a menu (the phone layout adds its editors to View) without
 * this table knowing about them.
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
          { id: "open", label: "Open files…", keys: "Ctrl O", run: openFiles },
          { id: "open-folder", label: "Open folder…", run: openFolder, shown: () => platform.canOpenFolders },
        ],
        [
          { id: "save", label: editor.folder ? "Save" : "Save as…", keys: "Ctrl S", run: save },
          { id: "save-as", label: "Save as…", run: saveChartAs, shown: () => !!editor.folder },
          { id: "package", label: "Package (.bbchart)…", run: savePackage },
          { id: "copy-chart", label: "Copy chart.json", run: copyChart },
        ],
      ],
    },
    {
      id: "edit", label: "Edit", groups: [
        [
          { id: "undo", label: "Undo", keys: "Ctrl Z", run: undo, enabled: () => doc.canUndo },
          { id: "redo", label: "Redo", keys: "Ctrl Y", run: redo, enabled: () => doc.canRedo },
        ],
        [
          { id: "copy", label: "Copy", keys: "Ctrl C", run: copySelected, enabled: selection },
          { id: "paste", label: "Paste at the playhead", keys: "Ctrl V", run: paste },
          { id: "mirror", label: "Mirror", keys: "X", run: mirrorSelected, enabled: selection },
          { id: "delete", label: "Delete", keys: "Delete", run: removeSelected, enabled: selection },
          { id: "select-none", label: "Select none", run: () => editor.selection.clear(), enabled: selection },
        ],
        [
          { id: "select-mode", label: "Select mode", run: () => { editor.selectMode = !editor.selectMode; }, checked: () => editor.selectMode },
          { id: "select-bar", label: "Select this bar", run: selectBar },
          { id: "select-loop", label: "Select the loop", run: selectLoop, shown: () => !!practice.loop },
          { id: "select-to-end", label: "Select to the end", run: selectToEnd },
          { id: "select-all", label: "Select all projectiles", run: selectAll },
        ],
      ],
    },
    {
      id: "view", label: "View", groups: [
        [
          { id: "zoom-in", label: "Zoom in", keys: "]", run: () => zoom(1.4) },
          { id: "zoom-out", label: "Zoom out", keys: "[", run: () => zoom(1 / 1.4) },
          { id: "fit", label: "Fit the chart", run: fit },
        ],
      ],
    },
  ];
  for (const menu of base) menu.groups.push(...(extra[menu.id] ?? []));
  return base;
}

/** The commands of a menu worth drawing: shown ones, in groups that still have any. */
export const visibleGroups = (menu: Menu): Command[][] =>
  menu.groups.map(group => group.filter(c => c.shown?.() ?? true)).filter(group => group.length);
