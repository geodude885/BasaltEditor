import { describe, expect, it } from "vitest";
import { SHORTCUTS } from "./keyboard";

const press = (key: string, ctrl = false) => SHORTCUTS.filter(s => s.matches({ key } as KeyboardEvent, ctrl, key.toLowerCase())).map(s => s.keysShown);

describe("the shortcut table", () => {
  it("gives each key one shortcut, with and without Ctrl", () => {
    for (const key of [" ", "Home", "p", "M", "Delete", "Backspace", "x", "ArrowLeft", "[", "]"]) expect(press(key)).toHaveLength(1);
    for (const key of ["c", "v", "z", "y", "s", "o"]) expect(press(key, true)).toHaveLength(1);
  });

  it("leaves Ctrl-free keys alone with Ctrl held, and the other way round", () => {
    expect(press("p", true)).toEqual([]);
    expect(press("s")).toEqual([]);
  });
});
