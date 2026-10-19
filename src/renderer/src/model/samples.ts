/** What the editor opens on the first time, so it shows what it does. */
export const SAMPLE = `{
  "format": 1,
  "name": "Crossfire",
  "author": "BossBattles",
  "difficulty": "Normal",
  "description": "Shots cutting across the lane. Hits on the Gunner count double while it is open.",
  // The lane centred on the Pit, running north.
  "arena": { "map": "pit", "at": { "x": 0, "z": -6 }, "facing": 0 },
  "bpm": 120,
  "lane": { "length": 12, "width": 3 },
  "actors": [ { "id": "gunner", "name": "The Gunner", "at": { "x": 0, "z": 12 } } ],
  "phases": [
    { "name": "Angles", "start": 0 },
    { "name": "Open", "start": 18, "scoreMultiplier": 2, "at": { "x": 1.2, "z": 10 } },
    { "name": "Storm", "start": 26 }
  ],
  "events": [
    { "t": 2,    "projectile": { "structure": "Disc", "from": { "x": -1.5, "y": 1.4, "z": 10 }, "to": { "x": 1.2,  "y": 1.3 }, "speed": 11, "telegraph": 0.8, "by": "gunner" } },
    { "t": 3.5,  "projectile": { "structure": "Disc", "from": { "x": 1.5,  "y": 1.4, "z": 10 }, "to": { "x": -1.2, "y": 1.3 }, "speed": 11, "telegraph": 0.8, "by": "gunner" } },
    { "t": 5,    "projectile": { "structure": "Disc", "from": { "x": 0,    "y": 1.5, "z": 11 }, "to": "player", "speed": 12, "telegraph": 0.7, "by": "gunner" } },
    { "t": 7,    "projectile": { "structure": "Ball", "from": { "x": -1.2, "y": 1.0, "z": 9 },  "to": { "x": 0.8,  "y": 1.0 }, "speed": 9, "telegraph": 0.8, "by": "gunner" } },
    { "t": 7.4,  "projectile": { "structure": "Ball", "from": { "x": 1.2,  "y": 1.0, "z": 9 },  "to": { "x": -0.8, "y": 1.0 }, "speed": 9, "telegraph": 0.8, "by": "gunner" } },
    { "t": 10,   "at": { "x": -1.2, "z": 11 } },
    { "t": 11,   "projectile": { "structure": "Disc", "from": { "x": -1.2, "y": 1.4, "z": 10 }, "to": "player", "speed": 13, "telegraph": 0.6, "by": "gunner" } },
    { "t": 12,   "projectile": { "structure": "Disc", "from": { "x": -1.2, "y": 1.4, "z": 10 }, "to": { "x": 1.0, "y": 1.4 }, "speed": 13, "telegraph": 0.6, "by": "gunner" } },
    { "t": 14,   "move": "Straight" },
    { "t": 20,   "projectile": { "structure": "Disc", "from": { "x": 1.2,  "y": 1.4, "z": 9 },  "to": "player", "speed": 10, "telegraph": 0.8, "by": "gunner" } },
    { "t": 27,   "projectile": { "structure": "Disc", "from": { "x": -1.5, "y": 1.2, "z": 10 }, "to": "player", "speed": 14, "telegraph": 0.5 } },
    { "t": 27.5, "projectile": { "structure": "Disc", "from": { "x": 1.5,  "y": 1.6, "z": 10 }, "to": "player", "speed": 14, "telegraph": 0.5 } },
    { "t": 28,   "projectile": { "structure": "Disc", "from": { "x": 0,    "y": 1.0, "z": 10 }, "to": "player", "speed": 14, "telegraph": 0.5 } },
    { "t": 28.5, "projectile": { "structure": "Disc", "from": { "x": 0,    "y": 1.9, "z": 10 }, "to": "player", "speed": 14, "telegraph": 0.5 } }
  ],
  "end": 33
}
`;

/** A new chart. */
export const template = (name: string, author?: string): string => `{
  // Made in Basalt Editor. The full format: docs/chart-format.md in the mod's repository.
  "format": 1,
  "name": ${JSON.stringify(name)},
  "author": ${JSON.stringify(author || "you")},
  "difficulty": "Easy",
  "description": "",
  "arena": { "map": "here" },
  "bpm": 120,
  "lane": { "length": 12, "width": 3 },
  "actors": [ { "id": "boss", "name": "Boss", "at": { "x": 0, "z": 12 }, "look": "you" } ],
  "events": [],
  "end": 16
}
`;
