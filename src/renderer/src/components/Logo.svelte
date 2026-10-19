<script lang="ts">
  // The Basalt mark in the colour of the text around it. Small sizes take the variant with wider gaps,
  // which stay open where the full mark's blur shut. `npm run icons` draws the app icons from the same files.
  import mark from "../assets/logo.svg?raw";
  import smallMark from "../assets/logo-small.svg?raw";

  const SMALLER_THAN_THIS_USES_THE_SMALL_MARK_PIXELS = 28;

  let { size = 24 }: { size?: number } = $props();
</script>

<span class="logo" style:width="{size}px" style:height="{size}px" aria-hidden="true">
  {@html size < SMALLER_THAN_THIS_USES_THE_SMALL_MARK_PIXELS ? smallMark : mark}
</span>

<style>
  .logo { display: inline-block; flex: none; }
  .logo :global(svg) { display: block; width: 100%; height: 100%; }
</style>
