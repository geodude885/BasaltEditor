// Some converters save MP3 audio inside a WAV file ("RIFF ... WAVE" with format 0x0055, often still
// named .mp3). Players cope; decoders that draw the waveform often don't. This finds the MP3 inside.

const MPEG_LAYER_3 = 0x0055;

/** The MP3 data inside a WAV wrapper, or null if these bytes aren't one. */
export function mp3InsideWav(bytes: Uint8Array): Uint8Array | null {
  const text = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
  if (bytes.length < 12 || text(0) !== "RIFF" || text(8) !== "WAVE") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let format = -1;
  for (let at = 12; at + 8 <= bytes.length;) {
    const id = text(at), size = view.getUint32(at + 4, true), body = at + 8;
    if (id === "fmt " && size >= 2) format = view.getUint16(body, true);
    if (id === "data") return format === MPEG_LAYER_3 ? bytes.subarray(body, Math.min(bytes.length, body + size)) : null;
    // Chunks are padded to an even length.
    at = body + size + (size % 2);
  }
  return null;
}
