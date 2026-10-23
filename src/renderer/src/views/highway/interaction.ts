// What a press on the highway means. The component asks, then applies what comes back.
import { columnIndexAtX, tilesAt, timeOfY, type HighwayView, type Tile } from "./geometry";

export type HighwayPress =
  /** A press on a tile: select it (adding to the selection, or not), then drag the selection. */
  | { kind: "tiles"; index: number }
  /** Box-select at once - with a mouse, or in Select mode. A mouse click without a drag adds there. */
  | { kind: "box"; clickAdds: boolean }
  /** A finger on empty space: a tap adds there, a drag scrubs, a long press box-selects. */
  | { kind: "wait" };

export function whatAHighwayPressHits(placed: Tile[], x: number, y: number, pointerType: string, selectMode: boolean): HighwayPress {
  const under = tilesAt(placed, x, y);
  if (under.length) return { kind: "tiles", index: under[0] };
  if (selectMode || pointerType === "mouse") return { kind: "box", clickAdds: pointerType === "mouse" };
  return { kind: "wait" };
}

export type HighwayTap = { kind: "let-go" } | { kind: "add"; column: number; seconds: number };

/** A tap on empty space: with something selected (and not adding to it), let go of it; else add a tile there. */
export function whatAHighwayTapDoes(view: HighwayView, columnCount: number, x: number, y: number, hasSelection: boolean, adding: boolean): HighwayTap {
  if (hasSelection && !adding) return { kind: "let-go" };
  return { kind: "add", column: columnIndexAtX(view, columnCount, x), seconds: Math.max(0, timeOfY(view, y)) };
}

/** Where a drag moves the tiles it started on: later the further up, and across by whole columns. */
export function tileDrag(view: HighwayView, columnCount: number, x0: number, y0: number, x: number, y: number): { seconds: number; columns: number } {
  return { seconds: (y0 - y) / view.pps, columns: columnIndexAtX(view, columnCount, x) - columnIndexAtX(view, columnCount, x0) };
}

/** A column moved by some columns, kept on the highway. */
export const shiftedColumn = (column: number, by: number, columnCount: number): number => Math.min(columnCount - 1, Math.max(0, column + by));

/** The playhead while a finger drags the highway: pulling it down brings later times to the hit line. */
export const scrubbedTime = (time0: number, y0: number, y: number, pps: number): number => Math.max(0, time0 + (y - y0) / pps);
