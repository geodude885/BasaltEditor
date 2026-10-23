<script lang="ts">
  // Timeline | Highway: which editor fills the timeline's place, in either layout - View's commands.
  import { commandButton } from "../store/commands";
</script>

<div class="views" role="group" aria-label="Editor">
  <button {...commandButton("view-timeline")}>Timeline</button>
  <button {...commandButton("view-highway")}>Highway</button>
</div>

<style>
  .views { display: flex; flex: none; }
  .views button { border-radius: 0; font: 600 13px var(--display); text-transform: uppercase; letter-spacing: .04em; }
  .views button:first-child { border-radius: 6px 0 0 6px; }
  .views button:last-child { border-radius: 0 6px 6px 0; border-left: 0; }
</style>
