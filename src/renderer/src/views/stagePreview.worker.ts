// One of the look preview's workers: paints the arena (kept while the size and key hue stay put) and shades
// the band of rows it is asked for, off the page's thread. stagePreview.ts hands out the bands.
import { paintStageScene, shadeStageFrame, type StageScene } from "../model/stageFrame";
import type { BandRequest, ShadedBand } from "./stagePreview";

let scene: StageScene | null = null, sceneKey = "";

self.onmessage = (ev: MessageEvent<BandRequest>) => {
  const { frame, width, height, keyHue, look, fight, firstRow, endRow } = ev.data;
  const key = `${width}x${height}@${keyHue}`;
  if (key !== sceneKey) { scene = paintStageScene(width, height, keyHue); sceneKey = key; }
  const bytes = new Uint8ClampedArray(width * (endRow - firstRow) * 4);
  shadeStageFrame(scene!, look, fight, bytes, firstRow, endRow);
  const band: ShadedBand = { frame, firstRow, bytes };
  (self as unknown as Worker).postMessage(band, [bytes.buffer]);
};
