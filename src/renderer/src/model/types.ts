// The chart's shapes, from the generated schema types. The editor reads charts loosely - a chart in
// progress may break the schema - so code coerces numbers (`+x || 0`) rather than trusting them.
import type { BasaltChart, Spot } from "./chart.gen";

export type { Spot };

/** A chart as written. */
export type Chart = BasaltChart;
/** A chart once loaded: it always has an events list. */
export type LoadedChart = Chart & { events: ChartEvent[] };

export type ChartEvent = NonNullable<BasaltChart["events"]>[number];
export type Projectile = NonNullable<ChartEvent["projectile"]>;
export type Structure = Projectile["structure"];
export type Aim = NonNullable<Projectile["to"]>;
export type Actor = NonNullable<BasaltChart["actors"]>[number];
export type Phase = NonNullable<BasaltChart["phases"]>[number];
export type PhaseColours = NonNullable<NonNullable<BasaltChart["phases"]>[number]["colours"]>;
export type LaneColours = NonNullable<BasaltChart["colours"]>;
export type PerformanceClip = NonNullable<NonNullable<BasaltChart["performances"]>[number]["clips"]>[number];
export type TempoChange = { beat: number; bpm: number };
export type LookCue = NonNullable<BasaltChart["shaders"]>[number];

export type EventKind = "projectile" | "move" | "at" | "?";
