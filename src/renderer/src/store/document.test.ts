import { describe, expect, it } from "vitest";
import { doc } from "./document.svelte";

// Two actors' performances, the second naming no actor (so the first actor's).
const DUET = `{
  "format": 3,
  "actors": [{ "id": "lead", "name": "Lead" }, { "id": "backup" }],
  "events": [{ "t": 1, "move": "Straight" }],
  "performances": [
    { "actor": "backup", "clips": [{ "t": 0, "clip": "b1" }, { "t": 4, "clip": "b2", "mime": true }] },
    { "clips": [{ "t": 2, "clip": "l1", "start": 1, "end": 3 }] }
  ]
}`;

// Left out on purpose: the projectile's `to` and `actor`, each aiming at the player and thrown by the first actor.
const ROUND_TRIP = `{
  "format": 3,
  "bpm": 120,
  "bpmChanges": [{ "beat": 8, "bpm": 140 }],
  "actors": [{ "id": "boss" }, { "id": "second" }],
  "events": [
    { "beat": 1, "projectile": { "structure": "Disc", "from": { "x": 0, "y": 1, "z": 10 }, "speed": 10 } },
    { "beat": 2, "move": "Kick", "actor": "second" }
  ]
}`;

describe("saving a format 3 chart", () => {
  it("keeps left-out fields left out, and tempo changes as they were", () => {
    doc.load(ROUND_TRIP, "Mine");
    doc.change(["name"], () => { doc.chart.name = "Renamed"; });
    doc.change(["events"], () => { doc.chart.events[0].projectile!.speed = 12; });
    const saved = doc.text;
    expect(saved).toContain('"bpmChanges": [{ "beat": 8, "bpm": 140 }]');
    expect(saved).not.toContain('"to"');
    expect(saved).not.toContain('"player"');
    expect(saved.match(/"actor"/g)).toHaveLength(1);
    doc.load(saved, "Mine");
    expect(doc.tempo.changes).toEqual([{ beat: 0, bpm: 120 }, { beat: 8, bpm: 140 }]);
    expect(doc.chart.events[0].projectile).not.toHaveProperty("to");
    expect(doc.chart.events[0]).not.toHaveProperty("actor");
  });
});

describe("saving a chart with recorded performances", () => {
  it("writes the performances back as they were when something else changes", () => {
    doc.load(DUET, "Duet");
    const performances = (text: string) => text.slice(text.indexOf('"performances"'));
    doc.change(["events"], () => { doc.chart.events[0].t = 2; });
    expect(doc.text).toContain('"t": 2');
    expect(performances(doc.text)).toBe(performances(DUET));
  });
});
