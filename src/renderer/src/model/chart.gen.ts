/* Generated from schema/chart.schema.json by scripts/sync-mod-data.mjs - do not edit. */

export type Colour = string;

/**
 * A Basalt chart, format 3. See docs/chart-format.md.
 */
export interface BasaltChart {
  $schema?: string;
  format?: number;
  name?: string;
  author?: string;
  difficulty?: string;
  description?: string;
  /**
   * Where it is played. Without one: the Ring, at { x: 0, z: -6 } facing north.
   */
  arena?: {
    map?: "gym" | "ring" | "pit";
    /**
     * Where you stand: metres from the map's centre (the Gym: world). Default 0, 0. Lane setup in game writes yours.
     */
    at?: {
      x: number;
      z: number;
      /**
       * Compass degrees the lane runs from you: 0 = +Z, 90 = +X. Default 0.
       */
      facing?: number;
    };
  };
  music?: {
    file: string;
    offset?: number;
    volume?: number;
  };
  /**
   * A PNG or JPG beside the chart, shown on the menu.
   */
  cover?: string;
  bpm?: number;
  /**
   * Tempo changes after the start, each holding until the next.
   */
  bpmChanges?: {
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
     * The stones it wears, up to two names. Without it: none.
     *
     * @maxItems 2
     */
    shiftstones?: [] | [string] | [string, string];
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
    t?: number;
    beat?: number;
    /**
     * The lane's colours from this phase on, over the chart's.
     */
    colours?: {
      sideLines?: Colour;
      endLines?: Colour;
      zoneLine?: Colour;
      backstop?: Colour;
      walls?: Colour;
    };
    scoreMultiplier?: number;
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
      /**
       * Where it arrives on your end of the lane. Without it: at you.
       */
      to?: {
        x: number;
        y: number;
      };
      speed: number;
      telegraph?: number;
      /**
       * Thrown along the floor in the game's grounded state. Default true for Pillar, RockCube and Wall.
       */
      grounded?: boolean;
    };
    move?: string;
    at?: Spot;
  })[];
  end?: number;
  /**
   * Recorded performances, written by RECORD / KEEP. Needs format 2.
   */
  performances?: {
    actor?: string;
    clips?: {
      t?: number;
      beat?: number;
      clip: string;
      start?: number;
      end?: number;
      mime?: boolean;
    }[];
  }[];
  /**
   * Where you may go: length along the lane from your end, height above the floor.
   */
  playerZone?: {
    length?: number;
    height?: number;
  };
  /**
   * The lane's colours, as #RRGGBB or #RRGGBBAA.
   */
  colours?: {
    sideLines?: Colour;
    endLines?: Colour;
    zoneLine?: Colour;
    backstop?: Colour;
    /**
     * Shows the invisible walls as see-through panes; give an opacity, e.g. #66ccff33.
     */
    walls?: string;
  };
  /**
   * Shader looks over time, for players with RumbleReShaded.
   */
  shaders?: {
    t?: number;
    beat?: number;
    /**
     * An installed RumbleReShaded pack's name, e.g. UltraShade.
     */
    pack: string;
    /**
     * Slider values by label or property.
     */
    values?: {
      [k: string]: number | undefined;
    };
    off?: boolean;
    fade?: number;
  }[];
  rules?: {
    /**
     * Breaks, without a sound, any structure wholly past your end of the lane, so they do not pile up behind you.
     */
    breakBehind?: boolean;
    /**
     * Seconds a structure may sit still in a battle before it breaks; 0 never.
     */
    breakStillAfter?: number;
    playerSpawns?: "all" | "discs" | "none";
  };
}
export interface Spot {
  x: number;
  z: number;
  facing?: number;
}
