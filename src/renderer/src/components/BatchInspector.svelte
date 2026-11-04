<script lang="ts">
  // Several projectiles selected: the fields they can share (model/projectileFields.ts), set for all of them at once.
  // A field they disagree on shows "mixed" until it's set. Times and places across the lane stay each one's own.
  // Each change is one undo step for the lot.
  import { editSelectedProjectileEvents } from "../store/actions";
  import { doc } from "../store/document.svelte";
  import { editing } from "../store/editing.svelte";
  import ProjectileFields from "./ProjectileFields.svelte";

  const shotEvents = $derived([...editing.selection].map(i => doc.chart.events[i]).filter(e => e?.projectile));
  const others = $derived(editing.selection.size - shotEvents.length);
</script>

{#if shotEvents.length}
  <div class="batch">
    <div class="note">
      Set any of these for all {shotEvents.length} projectile{shotEvents.length === 1 ? "" : "s"}{others ? ` (the ${others} other event${others === 1 ? "" : "s"} selected stay as they are)` : ""}.
      Their times and places across the lane stay their own; a field shows only when it applies to all of them.
    </div>
    <ProjectileFields events={shotEvents} edit={editSelectedProjectileEvents} />
  </div>
{/if}

<style>
  .batch { display: grid; gap: 10px; }
</style>
