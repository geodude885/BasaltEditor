import { describe, expect, it } from "vitest";
import { setEvTime, sortByTime } from "./chart";
import { copyItems, pasteItems } from "./clipboard";
import { Tempo } from "./tempo";
import type { LookCue } from "./types";

const tempo = new Tempo(120);

describe("copying and pasting a section", () => {
  it("keeps events and looks apart in time as they were, each written as it was", () => {
    const copied = copyItems([{ t: 4, move: "Kick" }], [{ beat: 6, pack: "Stage", values: { a: 1 } }, { t: 5, pack: "Stage" }], tempo);
    const { events, cues } = pasteItems(copied, 10, tempo);
    expect(events).toEqual([{ t: 11, move: "Kick" }]);
    expect(cues).toEqual([{ beat: 20, pack: "Stage", values: { a: 1 } }, { t: 12, pack: "Stage" }]);
  });

  it("copies, rather than keeping hold of the originals", () => {
    const cue: LookCue = { t: 1, pack: "Stage", values: { a: 1 } };
    const copied = copyItems([], [cue], tempo);
    cue.values!.a = 2;
    expect(pasteItems(copied, 0, tempo).cues[0].values).toEqual({ a: 1 });
  });

  it("leaves out what has no time", () => {
    expect(copyItems([{ move: "Kick" }], [], tempo)).toEqual([]);
  });
});

describe("placing things in time", () => {
  it("drops a beat it can't keep without a tempo, as a chart may not have both", () => {
    const cue: LookCue = { beat: 4, pack: "Stage" };
    setEvTime(cue, 3, new Tempo(undefined));
    expect(cue).toEqual({ pack: "Stage", t: 3 });
  });

  it("sorts by time, keeping ties in order and what has no time last", () => {
    const items = [{ pack: "none" }, { t: 2, pack: "b" }, { t: 1, pack: "a" }, { t: 2, pack: "c" }];
    expect(sortByTime(items, tempo).map(item => item.pack)).toEqual(["a", "b", "c", "none"]);
  });
});
