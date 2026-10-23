import { describe, expect, it } from "vitest";
import { shortcutCommands } from "./commands";
import { chordsOf, pressMatches } from "./keyboard";

type Press = { key: string; ctrl?: boolean; shift?: boolean };
const event = ({ key, ctrl = false, shift = false }: Press) => ({ key, ctrlKey: ctrl, metaKey: false, shiftKey: shift, altKey: false });
/** The ids of the commands a press would match, whether or not they apply just now. */
const matching = (press: Press) =>
  shortcutCommands().filter(c => chordsOf(c.keys!).some(chord => pressMatches(chord, event(press), c.anyShift))).map(c => c.id);

describe("the command table's keys", () => {
  it("reads the keys as they are written", () => {
    expect(chordsOf("Ctrl Shift Z")).toEqual([{ ctrl: true, shift: true, alt: false, key: "z" }]);
    expect(chordsOf("Delete / Backspace").map(c => c.key)).toEqual(["delete", "backspace"]);
    expect(chordsOf("Space")[0].key).toBe(" ");
    expect(chordsOf("←")[0].key).toBe("arrowleft");
  });

  it("gives each press one command at most", () => {
    const seen = new Map<string, string>();
    for (const command of shortcutCommands()) {
      for (const chord of chordsOf(command.keys!)) {
        const name = `${chord.ctrl ? "Ctrl " : ""}${chord.shift ? "Shift " : ""}${chord.key}`;
        expect(seen.get(name), `${name}: ${command.id} and ${seen.get(name)}`).toBeUndefined();
        seen.set(name, command.id);
      }
    }
  });

  it("matches the keys people press", () => {
    expect(matching({ key: " " })).toEqual(["play"]);
    expect(matching({ key: "P", shift: true })).toEqual([]);
    expect(matching({ key: "p" })).toEqual(["add-projectile"]);
    expect(matching({ key: "z", ctrl: true })).toEqual(["undo"]);
    expect(matching({ key: "Z", ctrl: true, shift: true })).toEqual(["redo"]);
    expect(matching({ key: "y", ctrl: true })).toEqual(["redo"]);
    expect(matching({ key: "Backspace" })).toEqual(["delete"]);
    expect(matching({ key: "ArrowLeft", shift: true })).toEqual(["nudge-left"]);
  });

  it("keeps Ctrl and plain keys apart", () => {
    expect(matching({ key: "p", ctrl: true })).toEqual([]);
    expect(matching({ key: "s" })).toEqual([]);
    expect(matching({ key: "s", ctrl: true })).toEqual(["save"]);
  });
});
