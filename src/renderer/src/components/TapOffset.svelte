<script lang="ts">
  // How much earlier each recorded tap lands, to make up for the screen's and the speaker's delay: a
  // tap is moved by the amount shown (−20 ms, earlier). In either layout's playing settings.
  import { recording } from "../store/recording.svelte";
  import { num } from "./fields";

  const shown = $derived(`${recording.offsetMs > 0 ? "−" : recording.offsetMs < 0 ? "+" : ""}${Math.abs(recording.offsetMs)} ms`);
</script>

<label title="If your taps land late, move this right; early, move it left.">
  <span>Tap timing {shown}</span>
  <input type="range" min="-150" max="250" step="5" value={recording.offsetMs} oninput={e => recording.setOffset(num(e))} />
</label>
