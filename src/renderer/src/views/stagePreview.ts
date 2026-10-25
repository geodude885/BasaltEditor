// Shades the look preview's frames on workers, so the editor never waits for them: each worker shades a
// band of rows, and while a frame is being shaded only the latest one asked for waits its turn - the
// preview drops frames rather than falling behind. Without workers (or if they fail) it shades in place.
import { paintStageScene, shadeStageFrame, type StageFight, type StageScene } from "../model/stageFrame";
import type { StageLook } from "../model/looks";

export type StageFrameRequest = { width: number; height: number; keyHue: number; look: StageLook; fight: StageFight };
export type BandRequest = StageFrameRequest & { frame: number; firstRow: number; endRow: number };
export type ShadedBand = { frame: number; firstRow: number; bytes: Uint8ClampedArray };

// Leave a core for the page; more than four bands gains little at the preview's size.
const workerCount = () => Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));

export class StagePreviewShader {
  #workers: Worker[] = [];
  #onFrame: (image: ImageData) => void;
  #frame = 0;
  #shading: { request: StageFrameRequest; image: ImageData; bandsLeft: number } | null = null;
  #waiting: StageFrameRequest | null = null;
  #inPlace: { scene: StageScene; key: string } | null = null;

  constructor(onFrame: (image: ImageData) => void) {
    this.#onFrame = onFrame;
    try {
      for (let i = 0; i < workerCount(); i++) {
        const worker = new Worker(new URL("./stagePreview.worker.ts", import.meta.url), { type: "module" });
        worker.onmessage = (ev: MessageEvent<ShadedBand>) => this.#shaded(ev.data);
        worker.onerror = ev => this.#workersFailed(ev);
        this.#workers.push(worker);
      }
    } catch (e) { this.#workersFailed(e); }
  }

  /** Shades this frame as soon as the workers are free, replacing any frame still waiting. */
  shade(request: StageFrameRequest): void {
    // Copied plain: a look read from $state is a proxy, which can't be posted to a worker.
    const plain: StageFrameRequest = { ...request, look: { on: request.look.on, settings: { ...request.look.settings } }, fight: { ...request.fight } };
    if (this.#shading) this.#waiting = plain;
    else this.#start(plain);
  }

  dispose(): void {
    for (const worker of this.#workers) worker.terminate();
    this.#workers = [];
    this.#shading = this.#waiting = null;
  }

  #start(request: StageFrameRequest): void {
    const { width, height } = request, image = new ImageData(width, height);
    if (!this.#workers.length) { this.#shadeInPlace(request, image); return; }
    const frame = ++this.#frame, bands = Math.min(this.#workers.length, height);
    this.#shading = { request, image, bandsLeft: bands };
    for (let band = 0; band < bands; band++) {
      const firstRow = Math.floor(height * band / bands), endRow = Math.floor(height * (band + 1) / bands);
      const message: BandRequest = { ...request, frame, firstRow, endRow };
      this.#workers[band].postMessage(message);
    }
  }

  #shaded(band: ShadedBand): void {
    const shading = this.#shading;
    if (!shading || band.frame !== this.#frame) return;
    shading.image.data.set(band.bytes, band.firstRow * shading.request.width * 4);
    if (--shading.bandsLeft > 0) return;
    this.#shading = null;
    this.#onFrame(shading.image);
    const next = this.#waiting;
    this.#waiting = null;
    if (next) this.#start(next);
  }

  #shadeInPlace(request: StageFrameRequest, image: ImageData): void {
    const key = `${request.width}x${request.height}@${request.keyHue}`;
    if (this.#inPlace?.key !== key) this.#inPlace = { scene: paintStageScene(request.width, request.height, request.keyHue), key };
    shadeStageFrame(this.#inPlace.scene, request.look, request.fight, image.data);
    this.#onFrame(image);
  }

  // Falls back to shading in place, starting again from the frame that was being shaded.
  #workersFailed(error: unknown): void {
    console.error("look preview workers failed; shading in place:", error);
    const request = this.#waiting ?? this.#shading?.request;
    this.dispose();
    if (request) this.#start(request);
  }
}
