import { describe, expect, it } from "vitest";
import { doc } from "./document.svelte";

// Two actors' tracks, the second naming no actor (so the first actor's).
const DUET = `{
  "format": 2,
  "actors": [{ "id": "lead", "name": "Lead" }, { "id": "backup" }],
  "events": [{ "t": 1, "move": "Straight" }],
  "tracks": [
    { "actor": "backup", "clips": [{ "t": 0, "clip": "b1" }, { "t": 4, "clip": "b2", "mime": true }] },
    { "clips": [{ "t": 2, "clip": "l1", "from": 1, "to": 3 }] }
  ]
}`;

describe("saving a chart with recorded tracks", () => {
  it("writes the tracks back as they were when something else changes", () => {
    doc.load(DUET, "Duet");
    const tracks = (text: string) => text.slice(text.indexOf('"tracks"'));
    doc.change(["events"], () => { doc.chart.events[0].t = 2; });
    expect(doc.text).toContain('"t": 2');
    expect(tracks(doc.text)).toBe(tracks(DUET));
  });
});
