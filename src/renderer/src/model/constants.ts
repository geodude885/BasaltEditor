import measured from "$data/structures.json";
import type { Structure } from "./types";

/** The newest chart format the mod reads, and what the editor writes (ChartLoader.NewestFormat). */
export const NEWEST_FORMAT = 3;

export const STRUCTURES: Structure[] = ["Disc", "Ball", "Pillar", "Wall", "RockCube", "BoulderBall", "SmallRock", "LargeRock"];
export const MOVES = ["Straight", "Uppercut", "Kick", "Stomp", "Explode", "Flick", "Parry", "Jump", "RockSlide", "Disc", "SpawnBall", "SpawnCube", "SpawnPillar", "SpawnWall", "HoldLeft", "HoldRight"];
export const MAPS = ["gym", "ring", "pit"] as const;
export const DIFFICULTIES = ["Easy", "Normal", "Hard", "Expert"];
/** Where a projectile with no `to` aims, roughly: your chest at your end. */
export const PLAYER_HEAD = 1.35;

export type Size = { across: number; along: number; up: number };
/**
 * Each structure's size in metres as the game has it - across the lane, along it and up - posed as a
 * projectile is, looking down the lane at you. Measured in game by the mod's =measure self-test;
 * `npm run sync` refreshes data/structures.json.
 */
export const SIZES: Record<string, Size> = measured;

/** Structures that come up out of the floor and rest on it, whatever height a chart gives. */
export const GROUNDED: Structure[] = ["Disc", "RockCube", "Pillar", "Wall"];
/** The ones the game spawns in its grounded state - thrown along the floor unless a chart says "grounded": false. */
export const GROUNDED_STATE: Structure[] = ["RockCube", "Pillar", "Wall"];

/** The game's shiftstones, as the mod reads them from its pools. */
export const STONES = ["Adamant", "Charge", "Flow", "Guard", "Stubborn", "Surge", "Vigor", "Volatile"];
/** The looks with names; anything else is a character string kept from the game. */
export const LOOKS: [value: string, label: string][] = [["you", "whoever plays"], ["default", "default"], ["defaultMale", "default male"], ["defaultFemale", "default female"]];

export type LaneColourKey = "sideLines" | "endLines" | "zoneLine" | "backstop";
/** The lane's parts a chart can colour, with the mod's own colours (LaneVisuals.cs). */
export const LANE_COLOURS: [key: LaneColourKey, label: string, mine: string][] = [
  ["sideLines", "Side lines", "#ff7319"], ["endLines", "End lines", "#ffd933"], ["zoneLine", "Zone line", "#f2f2d9"], ["backstop", "Backstop frame", "#ff7319"],
];
export const WALL_COLOUR = "#66ccff";
export const WALL_DEFAULT = "#66ccff33";
