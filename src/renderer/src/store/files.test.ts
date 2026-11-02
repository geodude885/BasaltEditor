import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenedFile, SameChartChoice } from "../../../shared/api";
import { desktopLibrary } from "../platform/library-desktop";

const FOLDER = "C:/Charts/Fight!";
const encode = (text: string) => new TextEncoder().encode(text);
const chart = (extra = "") => `{ "format": 3, "name": "Fight!", "difficulty": "Medium", "music": { "file": "song.mp3" }, "cover": "cover.png", "events": []${extra} }`;

/** The desktop app, over a Charts folder held in memory that outlives a restart of the page. */
function fakeEditor(folders: Map<string, Map<string, Uint8Array>>, choice: SameChartChoice = "there") {
  const textIn = (folder: string) => new TextDecoder().decode(folders.get(folder)!.get("chart.json"));
  const read = async (folder: string) => {
    if (!folders.has(folder)) throw new Error("gone");
    return { folder, files: [...folders.get(folder)!].map(([path, bytes]): OpenedFile => ({ path, bytes })) };
  };
  return {
    chartsFolder: async () => "C:/Charts",
    listCharts: async () => [...folders.keys()].map(folder => ({ folder, text: textIn(folder), modified: 0, images: [] })),
    readFolder: read,
    openFolder: () => read(FOLDER),
    openFiles: vi.fn(async (): Promise<OpenedFile[]> => []),
    saveChart: vi.fn(async (folder: string, text: string) => { folders.get(folder)!.set("chart.json", encode(text)); }),
    saveFiles: vi.fn(async () => {}),
    createChartFolder: vi.fn(async (_name: string, files: OpenedFile[]) => {
      folders.set("C:/Charts/fight!-medium", new Map(files.map(f => [f.path, f.bytes])));
      return "C:/Charts/fight!-medium";
    }),
    renameChartFolder: vi.fn(async (folder: string) => folder),
    askSameChart: vi.fn(async () => choice),
    recentFolders: async () => [],
    readCover: async () => null,
    trashFolder: async () => {},
    duplicateFolder: async () => ({ folder: "", text: "" }),
    askUnsaved: async () => "discard" as const,
    saveFile: async () => null,
    setTheme: async () => {},
  };
}

/** The page starting: nothing kept but what's in storage. As App.svelte and main.ts do. */
async function startPage(api: ReturnType<typeof fakeEditor>) {
  vi.resetModules();
  vi.stubGlobal("window", { editor: api, setTimeout, clearTimeout });
  vi.stubGlobal("Audio", class { removeAttribute() {} });
  const { doc, restoreDraft } = await import("./document.svelte");
  const { session } = await import("./session.svelte");
  const files = await import("./files");
  const { library } = await import("./library.svelte");
  library.start(desktopLibrary(api as never));
  const draft = restoreDraft();
  if (draft) {
    doc.load(draft.text, draft.name);
    await files.reopenDraftFolder(draft.unsaved);
  }
  return { doc, session, files, library };
}

const addRule = (doc: Awaited<ReturnType<typeof startPage>>["doc"]) => doc.change(["rules"], () => { doc.chart.rules = { breakBehind: true }; });

describe("a chart opened from a folder", () => {
  let folders: Map<string, Map<string, Uint8Array>>;

  beforeEach(() => {
    const kept = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => kept.get(key) ?? null,
      setItem: (key: string, value: string) => { kept.set(key, value); },
      removeItem: (key: string) => { kept.delete(key); },
    });
    folders = new Map([[FOLDER, new Map([["chart.json", encode(chart())], ["cover.png", encode("cover")]])]]);
  });

  it("keeps its folder through a restart and a library refresh, so Save changes its chart.json", async () => {
    const api = fakeEditor(folders);
    const first = await startPage(api);
    await first.files.openFolder();
    expect(first.session.folder).toBe(FOLDER);

    const { doc, session, files, library } = await startPage(api);
    await library.refresh();
    expect(session.folder).toBe(FOLDER);
    expect(session.files.has("cover.png")).toBe(true);

    addRule(doc);
    await files.save();
    expect(api.createChartFolder).not.toHaveBeenCalled();
    expect(api.saveChart).toHaveBeenCalledWith(FOLDER, doc.text);
    expect(new TextDecoder().decode(folders.get(FOLDER)!.get("chart.json"))).toContain("breakBehind");
    expect(folders.size).toBe(1);
  });

  it("keeps unsaved changes through a restart, still unsaved", async () => {
    const api = fakeEditor(folders);
    const first = await startPage(api);
    await first.files.openFolder();
    addRule(first.doc);

    const { doc, session } = await startPage(api);
    expect(session.folder).toBe(FOLDER);
    expect(doc.text).toContain("breakBehind");
    expect(doc.dirty).toBe(true);
  });

  it("takes the file over a draft with nothing unsaved, as the game may have changed it", async () => {
    const api = fakeEditor(folders);
    await (await startPage(api)).files.openFolder();
    folders.get(FOLDER)!.set("chart.json", encode(chart(`, "end": 40`)));

    const { doc } = await startPage(api);
    expect(doc.chart.end).toBe(40);
    expect(doc.dirty).toBe(false);
  });

  it("asks before making a second folder for a chart with no folder, and can save into the first", async () => {
    const api = fakeEditor(folders);
    const { doc, session, files } = await startPage(api);
    doc.load(chart(), "chart.json");
    addRule(doc);
    await files.save();
    expect(api.askSameChart).toHaveBeenCalledWith("Fight!", "Fight!");
    expect(api.createChartFolder).not.toHaveBeenCalled();
    expect(session.folder).toBe(FOLDER);
    expect(session.files.has("cover.png")).toBe(true);
    expect(new TextDecoder().decode(folders.get(FOLDER)!.get("chart.json"))).toContain("breakBehind");
  });

  it("makes nothing when that's cancelled, and a new folder when asked for one", async () => {
    const cancelled = fakeEditor(folders, "cancel");
    const page = await startPage(cancelled);
    page.doc.load(chart(), "chart.json");
    await page.files.save();
    expect(cancelled.createChartFolder).not.toHaveBeenCalled();
    expect(cancelled.saveChart).not.toHaveBeenCalled();

    const separate = fakeEditor(folders, "new");
    const again = await startPage(separate);
    again.doc.load(chart(), "chart.json");
    await again.files.save();
    expect(separate.createChartFolder).toHaveBeenCalledOnce();
  });

  it("opens the folder when its chart.json is picked on its own", async () => {
    const api = fakeEditor(folders);
    api.openFiles.mockResolvedValue([{ path: "chart.json", bytes: encode(chart()), folder: FOLDER }]);
    const { session, files } = await startPage(api);
    await files.openFiles();
    expect(session.folder).toBe(FOLDER);
    expect(session.files.has("cover.png")).toBe(true);
  });
});
