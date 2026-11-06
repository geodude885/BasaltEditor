import { describe, expect, it } from "vitest";
import type { LiveLinkPack } from "../../../shared/api";
import { beatGlobals, looksToShow, playerValueIn, shownTime } from "./liveLink";
import type { TimedLookCue } from "./looks";
import { Tempo } from "./tempo";

const packs: LiveLinkPack[] = [{ id: "UltraShade", name: "UltraShade", parameters: [
  { property: "_Saturation", label: "Saturation", min: 0, max: 2, default: 1, player: 0.5 },
] }];
const cue = (index: number, time: number, fade: number, values: [string, number][], off = false): TimedLookCue =>
  ({ index, time, pack: "UltraShade", values, off, fade });

describe("what the live link shows", () => {
  it("reads the player's values from the game, by label or property", () => {
    const value = playerValueIn(packs);
    expect(value("ultrashade", "saturation")).toBe(0.5);
    expect(value("UltraShade", "_Saturation")).toBe(0.5);
    expect(value("UltraShade", "Nothing")).toBe(0);
  });

  it("fades from the player's value", () => {
    expect(looksToShow([cue(0, 2, 2, [["Saturation", 1.5]])], 3, packs)).toEqual([{ pack: "UltraShade", on: true, values: { Saturation: 1 } }]);
  });

  it("leaves a pack out before its first look and once it's off", () => {
    const cues = [cue(0, 2, 0, [["Saturation", 1.5]]), cue(1, 4, 0, [], true)];
    expect(looksToShow(cues, 1, packs)).toEqual([]);
    expect(looksToShow(cues, 3, packs)).toHaveLength(1);
    expect(looksToShow(cues, 5, packs)).toEqual([]);
  });

  it("shows where a selected look's fade ends while paused in it, and the playhead otherwise", () => {
    const cues = [cue(0, 2, 3, [["Saturation", 1.5]])];
    expect(shownTime(cues, 2, false, 0)).toBe(5);
    expect(shownTime(cues, 2, true, 0)).toBe(2);
    expect(shownTime(cues, 1, false, 0)).toBe(1);
    expect(shownTime(cues, 6, false, 0)).toBe(6);
    expect(shownTime(cues, 2, false, -1)).toBe(2);
  });
});

describe("the beat the live link shows in the game", () => {
  it("is Basalt's beat at the playhead, mid-battle and at full health", () => {
    expect(beatGlobals(1.25, new Tempo(120))).toEqual({
      "basalt.running": 1, "basalt.time": 1.25, "basalt.health": 1, "basalt.beat": 0.5, "basalt.beatNumber": 2, "basalt.beatsPerSecond": 2,
    });
  });

  it("leaves the beat out without a tempo, putting it back to 0", () => {
    expect(beatGlobals(3, new Tempo(undefined))).toEqual({
      "basalt.running": 1, "basalt.time": 3, "basalt.health": 1, "basalt.beat": null, "basalt.beatNumber": null, "basalt.beatsPerSecond": null,
    });
  });
});
