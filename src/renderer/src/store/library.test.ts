import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChartSummary, LibrarySource, StoredChart } from "./library.svelte";

const summary = (id: string, name: string): ChartSummary => ({ id, name, projectiles: 0, created: 0, updated: 0 });
const STORED = `{ "name": "Mine", "events": [{ "t": 1, "move": "Kick" }] }`;

/** A library holding one chart, that says what it was asked to save. */
function source(autosaves: boolean): LibrarySource & { saved: string[] } {
  const saved: string[] = [];
  return {
    autosaves, saved,
    list: async () => [summary("mine", "Mine")],
    load: async (): Promise<StoredChart> => ({ summary: summary("mine", "Mine"), text: STORED, files: new Map() }),
    save: async (_summary, text) => { saved.push(text); },
    remove: async () => {},
  };
}

/** The page starting, in either order: the web's library starts before the page mounts, the desktop's after. */
async function start() {
  vi.resetModules();
  const { doc, restoreDraft } = await import("./document.svelte");
  const { library } = await import("./library.svelte");
  return { doc, library, restoreDraft };
}

describe("starting up", () => {
  let kept: Map<string, string>;

  beforeEach(() => {
    kept = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => kept.get(key) ?? null,
      setItem: (key: string, value: string) => { kept.set(key, value); },
      removeItem: (key: string) => { kept.delete(key); },
    });
    vi.stubGlobal("window", { editor: {}, setTimeout, clearTimeout });
    vi.stubGlobal("Audio", class { removeAttribute() {} });
  });

  it("shows Your charts whichever comes first, the library or the page", async () => {
    const late = await start();
    late.library.showOnceStarted();
    expect(late.library.visible).toBe(false);
    late.library.start(source(false));
    expect(late.library.visible).toBe(true);

    const early = await start();
    early.library.start(source(false));
    early.library.showOnceStarted();
    expect(early.library.visible).toBe(true);
  });

  it("takes no notice of a draft of the old example", async () => {
    kept.set("basalt-draft", JSON.stringify({ text: `{ "name": "Crossfire" }`, name: "Crossfire (example)" }));
    expect((await start()).restoreDraft()).toBeNull();
    kept.set("basalt-draft", JSON.stringify({ text: `{ "name": "Mine" }`, name: "chart.json" }));
    expect((await start()).restoreDraft()?.text).toContain("Mine");
  });

  it("reopens last time's chart from the library with no draft, never saving a blank over it", async () => {
    kept.set("basalt-library-current", "mine");
    const { doc, library } = await start();
    const mine = source(true);
    library.start(mine);
    doc.load(`{ "name": "My Chart", "events": [] }`, "chart.json");
    await vi.waitFor(() => expect(doc.chart.name).toBe("Mine"));
    await library.flush();
    expect(mine.saved.every(text => text.includes("Mine"))).toBe(true);
  });
});
