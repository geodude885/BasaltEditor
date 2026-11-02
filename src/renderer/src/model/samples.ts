import { NEWEST_FORMAT } from "./constants";

/** A new chart. */
export const template = (name: string, author?: string): string => `{
  // Made in Basalt Editor. The full format: docs/chart-format.md in the mod's repository.
  "format": ${NEWEST_FORMAT},
  "name": ${JSON.stringify(name)},
  "author": ${JSON.stringify(author || "you")},
  "difficulty": "Easy",
  "description": "",
  "arena": { "map": "ring", "at": { "x": 0, "z": -6, "facing": 0 } },
  "bpm": 120,
  "lane": { "length": 12, "width": 3 },
  "actors": [ { "id": "boss", "name": "Boss", "at": { "x": 0, "z": 12 }, "look": "you" } ],
  "events": [],
  "end": 16
}
`;
