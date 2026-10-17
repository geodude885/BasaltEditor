// Zip: read (stored or deflated) and write (stored). Packages are small and mostly already-compressed
// audio and images, so writing without compression costs little.

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) c = crcTable[(c ^ data[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/** A zip's files by path. Folders, absolute paths and ".." are skipped. */
export async function readZip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), files = new Map<string, Uint8Array>();
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("it is not a zip");
  let at = view.getUint32(eocd + 16, true);
  const count = view.getUint16(eocd + 10, true);
  if (count > 512) throw new Error("it has more than 512 files");
  for (let n = 0; n < count; n++) {
    const method = view.getUint16(at + 10, true), size = view.getUint32(at + 20, true), nameLength = view.getUint16(at + 28, true);
    const extra = view.getUint16(at + 30, true), comment = view.getUint16(at + 32, true), local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength)).replace(/\\/g, "/");
    at += 46 + nameLength + extra + comment;
    if (name.endsWith("/") || name.split("/").includes("..") || name.startsWith("/")) continue;
    const dataAt = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const raw = bytes.subarray(dataAt, dataAt + size);
    files.set(name, method === 0 ? raw.slice() : await inflate(raw));
  }
  return files;
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A zip of the entries, stored without compression. */
export function writeZip(entries: Iterable<[name: string, data: Uint8Array]>): Uint8Array {
  const parts: Uint8Array[] = [], central: Uint8Array[] = [];
  let offset = 0, count = 0;
  for (const [name, data] of entries) {
    const nameBytes = new TextEncoder().encode(name), crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true); local.setUint32(22, data.length, true); local.setUint16(26, nameBytes.length, true);
    const head = new DataView(new ArrayBuffer(46));
    head.setUint32(0, 0x02014b50, true); head.setUint16(4, 20, true); head.setUint16(6, 20, true); head.setUint32(16, crc, true);
    head.setUint32(20, data.length, true); head.setUint32(24, data.length, true); head.setUint16(28, nameBytes.length, true); head.setUint32(42, offset, true);
    parts.push(new Uint8Array(local.buffer), nameBytes, data);
    central.push(new Uint8Array(head.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
    count++;
  }
  const size = central.reduce((s, p) => s + p.length, 0), endRecord = new DataView(new ArrayBuffer(22));
  endRecord.setUint32(0, 0x06054b50, true); endRecord.setUint16(8, count, true); endRecord.setUint16(10, count, true);
  endRecord.setUint32(12, size, true); endRecord.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(endRecord.buffer)], out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
  let at = 0;
  for (const p of all) { out.set(p, at); at += p.length; }
  return out;
}
