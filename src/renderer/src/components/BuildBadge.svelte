<script lang="ts">
  // Marks a test copy of the website (the prerelease, or a pull request's preview), so it can't be
  // mistaken for the live site. Nothing on the live site or in the desktop app.
  // `short`: just which copy, without its commit - for the phone's crowded bar.
  let { short = false }: { short?: boolean } = $props();
  const label = __BUILD_LABEL__;
</script>

{#if label}<span class="badge" title="A test copy of Basalt Editor: {label}">{short ? label.split(" · ")[0] : label}</span>{/if}

<style>
  .badge {
    flex: none; padding: 2px 6px; border-radius: 6px; white-space: nowrap;
    font: 600 11px/1.3 var(--mono); color: var(--accent); border: 1px solid var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }
</style>
