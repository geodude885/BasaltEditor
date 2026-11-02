import { beforeEach, describe, expect, it, vi } from "vitest";
import { addStageCueAtPlayhead, copySelected, editLookCue, nudge, paste, redo, removeSelected, select, selectLook, undo } from "./actions";
import { doc } from "./document.svelte";
import { editing } from "./editing.svelte";
import { transport } from "./transport.svelte";

const CHART = `{
  "bpm": 120,
  "events": [{ "t": 1, "move": "Kick" }, { "t": 8, "move": "Stomp" }],
  "shaders": [{ "t": 2, "pack": "A", "fade": 1 }, { "t": 6, "pack": "B" }]
}`;
const packs = () => doc.chart.shaders?.map(cue => cue.pack);

beforeEach(() => {
  vi.stubGlobal("window", { setTimeout, clearTimeout });
  doc.load(CHART, "chart.json");
  editing.clearSelection();
  editing.snap = 0.5;
  transport.time = 0;
});

describe("looks in the selection", () => {
  it("selects beside events with add, and alone without", () => {
    select(0, false);
    selectLook(1, true);
    expect(editing.selectedCount).toBe(2);
    expect(editing.selectedLookCue).toBe(1);
    selectLook(0, true);
    expect(editing.selectedLookCue).toBe(-1);
    selectLook(1, true);
    selectLook(0, true);
    expect(editing.selectedLooks.size).toBe(0);
    selectLook(1, false);
    expect(editing.selection.size).toBe(0);
  });

  it("stay selected when moving them re-sorts the list", () => {
    selectLook(0, false);
    nudge(1, true);
    nudge(1, true);
    nudge(1, true);
    expect(packs()).toEqual(["B", "A"]);
    expect(doc.chart.shaders![1].t).toBe(8);
    expect(editing.selectedLookCue).toBe(1);
  });

  it("follow a new time typed into one", () => {
    selectLook(0, false);
    editLookCue(0, cue => { cue.t = 9; });
    expect(packs()).toEqual(["B", "A"]);
    expect(editing.selectedLookCue).toBe(1);
    expect(doc.text.indexOf('"B"')).toBeLessThan(doc.text.indexOf('"A"'));
  });

  it("keep a new look selected where it sorts to", () => {
    transport.time = 4;
    addStageCueAtPlayhead();
    expect(packs()).toEqual(["A", "BossBattles Stage", "B"]);
    expect(editing.selectedLookCue).toBe(1);
  });

  it("paste with events as one undo step, at the snapped playhead, selected", () => {
    select(0, false);
    selectLook(0, true);
    copySelected();
    transport.time = 10.1;
    paste();
    expect(doc.chart.events.map(e => e.t)).toEqual([1, 8, 10]);
    expect(doc.chart.shaders!.map(cue => cue.t)).toEqual([2, 6, 11]);
    expect([...editing.selection]).toEqual([2]);
    expect([...editing.selectedLooks]).toEqual([2]);
    undo();
    expect(doc.chart.events).toHaveLength(2);
    expect(doc.chart.shaders).toHaveLength(2);
    expect(editing.hasSelection).toBe(false);
    redo();
    expect(doc.chart.shaders).toHaveLength(3);
  });

  it("delete with events, and take the key away with the last", () => {
    select(1, false);
    selectLook(0, true);
    selectLook(1, true);
    removeSelected();
    expect(doc.chart.events.map(e => e.t)).toEqual([1]);
    expect(doc.chart.shaders).toBeUndefined();
    expect(doc.text).not.toContain("shaders");
    expect(editing.hasSelection).toBe(false);
  });
});
