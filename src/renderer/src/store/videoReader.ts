// Reading a music video's frames in the page, for the converters: it steps through the video by seeking, a frame at a
// time, and measures each one small (video/frames.ts). Stepping rather than playing reads every frame, so the same video
// always measures the same - played fast, the browser drops frames, and different ones each time.
import { FrameMeasurer, MEASURE_HEIGHT, MEASURE_WIDTH, type FrameFeatures } from "../video/frames";

/** Frames a second it reads, whatever the video's own rate: enough for a strobe, and every frame of most music videos. */
export const READ_FRAMES_A_SECOND = 24;

export type VideoRead = { frames: FrameFeatures[]; duration: number };

/** Every frame of a video, measured. Calls back with how far through it is (0 to 1); stops, rejecting, when aborted. */
export async function readVideoFrames(bytes: Uint8Array, onProgress: (done: number) => void, signal: AbortSignal): Promise<VideoRead> {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart]));
  const video = document.createElement("video");
  video.muted = true; video.playsInline = true; video.preload = "auto"; video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.addEventListener("loadeddata", () => resolve(), { once: true });
      video.addEventListener("error", () => reject(new Error("the browser can't play that video")), { once: true });
    });
    const canvas = document.createElement("canvas");
    canvas.width = MEASURE_WIDTH; canvas.height = MEASURE_HEIGHT;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    const measurer = new FrameMeasurer(), frames: FrameFeatures[] = [];
    const count = Math.floor(video.duration * READ_FRAMES_A_SECOND);
    for (let i = 0; i < count; i++) {
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      // Half a frame in, so each seek lands inside its frame rather than on the edge between two.
      const time = (i + 0.5) / READ_FRAMES_A_SECOND;
      await new Promise<void>(resolve => { video.addEventListener("seeked", () => resolve(), { once: true }); video.currentTime = time; });
      context.drawImage(video, 0, 0, MEASURE_WIDTH, MEASURE_HEIGHT);
      frames.push(measurer.measure(context.getImageData(0, 0, MEASURE_WIDTH, MEASURE_HEIGHT).data, i / READ_FRAMES_A_SECOND));
      if (i % 12 === 0) onProgress(i / count);
    }
    onProgress(1);
    return { frames, duration: video.duration };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
