/* Generated from schema/chart.schema.json by scripts/sync-mod-data.mjs - do not edit. */

export type Colour = string;

/**
 * A BossBattles chart, format 2. See docs/chart-format.md.
 */
export interface BossBattlesChart {
  $schema?: string;
  format?: number;
  name?: string;
  author?: string;
  difficulty?: string;
  description?: string;
  arena?: {
    map?: "here" | "gym" | "ring" | "pit";
    /**
     * Where you stand: metres from the arena's centre (Gym: world). Where am I, in the settings, prints yours.
     */
    at?: {
      x: number;
      z: number;
    };
    /**
     * Compass degrees the lane runs from you: 0 = +Z, 90 = +X.
     */
    facing?: number;
  };
  music?: {
    file: string;
    start?: number;
    volume?: number;
  };
  /**
   * A PNG or JPG beside the chart, shown on the picker.
   */
  cover?: string;
  bpm?:
    | number
    | {
        beat: number;
        bpm: number;
      }[];
  lane?: {
    length?: number;
    width?: number;
  };
  actors?: {
    id?: string;
    name?: string;
    at?: Spot;
    /**
     * "you" for whoever plays's stones, or up to two names.
     */
    shiftstones?: "you" | [] | [string] | [string, string];
    look?: string;
    /**
     * The body's size in metres; keeping a clip stores the recorder's.
     */
    measurement?: {
      height: number;
      armSpan: number;
    };
  }[];
  phases?: {
    name?: string;
    start?: number;
    startBeat?: number;
    /**
     * The lane's colours from this phase on, over the chart's.
     */
    colours?: {
      edges?: Colour;
      ends?: Colour;
      zone?: Colour;
      backstop?: Colour;
      walls?: Colour;
    };
    scoreMultiplier?: number;
    actor?: string;
    at?: Spot;
  }[];
  events?: ({
    [k: string]: unknown | undefined;
  } & {
    t?: number;
    beat?: number;
    actor?: string;
    projectile?: {
      structure: "Disc" | "Ball" | "Pillar" | "Wall" | "RockCube" | "BoulderBall" | "SmallRock" | "LargeRock";
      from: {
        x: number;
        y: number;
        z: number;
      };
      to?:
        | "player"
        | {
            x: number;
            y: number;
          };
      speed: number;
      telegraph?: number;
      /**
       * Thrown along the floor in the game's grounded state. Default true for Pillar, RockCube and Wall.
       */
      grounded?: boolean;
      by?: string;
    };
    move?: string;
    at?: Spot;
  })[];
  end?: number;
  /**
   * Recorded performances, written by RECORD / KEEP. Needs format 2.
   */
  tracks?: {
    actor?: string;
    clips?: {
      t?: number;
      beat?: number;
      clip: string;
      from?: number;
      to?: number;
      mime?: boolean;
    }[];
  }[];
  /**
   * Where you may go: length along the lane from your end, height above the floor.
   */
  zone?: {
    length?: number;
    height?: number;
  };
  /**
   * The lane's colours, as #RRGGBB or #RRGGBBAA.
   */
  colours?: {
    edges?: Colour;
    ends?: Colour;
    zone?: Colour;
    backstop?: Colour;
    /**
     * Shows the invisible walls as see-through panes; give an opacity, e.g. #66ccff33.
     */
    walls?: string;
  };
  /**
   * Shader looks over time, for players with RumbleReShaded.
   */
  visuals?: {
    t?: number;
    beat?: number;
    /**
     * An installed RumbleReShaded pack's name, e.g. UltraShade.
     */
    pack: string;
    /**
     * Slider values by label or property.
     */
    set?: {
      [k: string]: number | undefined;
    };
    on?: boolean;
    off?: boolean;
    fade?: number;
  }[];
  rules?: {
    /**
     * Seconds a structure may sit still in a battle before it breaks; 0 never.
     */
    cleanup?: number;
    spawn?: "all" | "discs" | "none";
  };
}
export interface Spot {
  x: number;
  z: number;
  facing?: number;
}
