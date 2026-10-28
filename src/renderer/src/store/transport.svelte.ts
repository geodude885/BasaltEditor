// The playhead and how the editor plays: store/playback.ts drives these; everything else reads them.
import { remember, remembered } from "./remembered";

const VOLUME_KEY = "basalt-volume";

class Transport {
  /** The playhead, in seconds of chart time. */
  time = $state(0);
  playing = $state(false);
  rate = $state(1);
  /** A click on every beat. */
  click = $state(false);
  /** How loud the editor plays - the song (times the chart's own volume) and the click. Remembered here, not saved in the chart. */
  volume = $state(remembered(VOLUME_KEY, 0.5, text => { const v = parseFloat(text); return v >= 0 && v <= 1 ? v : undefined; }));

  rememberVolume(): void { remember(VOLUME_KEY, String(this.volume)); }
}

export const transport = new Transport();
