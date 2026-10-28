import { beforeEach, describe, expect, it } from "vitest";
import { transport } from "./transport.svelte";
import { keepLooping, loopPoint, loopPointLabel, practice, rewindBars } from "./practice.svelte";

describe("the A-B loop", () => {
  beforeEach(() => {
    practice.loop = null;
    practice.loopStart = null;
    transport.playing = false;
    transport.time = 0;
  });

  it("sets A, then B, then clears", () => {
    transport.time = 4;
    loopPoint();
    expect(practice.loopStart).toBe(4);
    expect(loopPointLabel()).toBe("Set B");
    transport.time = 10;
    loopPoint();
    expect(practice.loop).toEqual([4, 10]);
    expect(practice.loopStart).toBeNull();
    expect(loopPointLabel()).toBe("Loop off");
    loopPoint();
    expect(practice.loop).toBeNull();
    expect(loopPointLabel()).toBe("Loop A");
  });

  it("takes B before A the right way round", () => {
    transport.time = 10;
    loopPoint();
    transport.time = 4;
    loopPoint();
    expect(practice.loop).toEqual([4, 10]);
  });

  it("goes back to A when playing passes B, and only while playing", () => {
    practice.loop = [4, 10];
    transport.time = 10.01;
    keepLooping();
    expect(transport.time).toBe(10.01);
    transport.playing = true;
    keepLooping();
    expect(transport.time).toBe(4);
  });

  it("rewinds no further than A inside the loop, and never forwards to it from before", () => {
    practice.loop = [30, 40];
    transport.time = 31;
    rewindBars(1);
    expect(transport.time).toBe(30);
    transport.time = 10;
    rewindBars(1);
    expect(transport.time).toBeLessThan(10);
  });
});
