<script lang="ts" module>
  // Line icons drawn in the text's colour, 1em square, instead of symbol characters (which phones
  // often draw as colour emoji). Add a shape here to use a new one.
  const SHAPES = {
    menu: "M4 6h16M4 12h16M4 18h16",
    start: "M6 5v14M19 5 9 12l10 7z",
    undo: "M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
    redo: "M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13",
    close: "M6 6l12 12M18 6 6 18",
    back: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5",
    right: "M9 6l6 6-6 6",
    down: "M6 9l6 6 6-6",
    check: "M5 12.5l4.5 4.5L19 7.5",
    record: "M12 6.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11z",
  } as const;

  export type IconName = keyof typeof SHAPES;
  /** Shapes drawn solid rather than as lines. */
  const FILLED: ReadonlySet<IconName> = new Set(["record"]);
</script>

<script lang="ts">
  let { name, size = "1em" }: { name: IconName; size?: string } = $props();
</script>

<svg class="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"
  fill={FILLED.has(name) ? "currentColor" : "none"} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d={SHAPES[name]} />
</svg>

<style>
  .icon { display: inline-block; vertical-align: -0.125em; flex: none; }
</style>
