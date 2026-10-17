// The chart's shapes, from the generated schema types. The editor reads charts loosely - a chart in
// progress may break the schema - so code coerces numbers (`+x || 0`) rather than trusting them.
import type { BossBattlesChart, Spot } from "./chart.gen";

export type { Spot };

/** A chart as written. `colors` is the American spelling the mod also accepts. */
export type Chart = BossBattlesChart & { colors?: LaneColours };
/** A chart once loaded: it always has an events list. */
export type LoadedChart = Chart & { events: ChartEvent[] };

export type ChartEvent = NonNullable<BossBattlesChart["events"]>[number];
export type Projectile = NonNullable<ChartEvent["projectile"]>;
export type Structure = Projectile["structure"];
export type Aim = NonNullable<Projectile["to"]>;
export type Actor = NonNullable<BossBattlesChart["actors"]>[number];
export type Phase = NonNullable<BossBattlesChart["phases"]>[number] & { colors?: PhaseColours };
export type PhaseColours = NonNullable<NonNullable<BossBattlesChart["phases"]>[number]["colours"]>;
export type LaneColours = NonNullable<BossBattlesChart["colours"]>;
export type TrackClip = NonNullable<NonNullable<BossBattlesChart["tracks"]>[number]["clips"]>[number];
export type TempoChange = { beat: number; bpm: number };

export type EventKind = "projectile" | "move" | "at" | "?";
