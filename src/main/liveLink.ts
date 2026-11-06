// The live link: a connection to RumbleReShaded in the running game, so a look can be previewed there.
// It only exists while someone has asked for it. Messages are JSON, one per line, as RumbleReShaded's
// docs/LIVE_LINK.md describes.
import { connect as connectTo, type Socket } from "node:net";
import type { LiveLinkGreeting, LiveLinkPack, LiveLinkUpdate } from "../shared/api";

const PORT = 47810;
const HELLO = "rrs-live-link";
const VERSION = 1;
const GIVE_UP_MS = 1500;

let socket: Socket | null = null;

export function disconnect(): void {
  socket?.destroy();
  socket = null;
}

/** Connects, says hello, and resolves with the installed packs and what the link can do. `closed` is called if it drops later. */
export function connect(closed: () => void, port = PORT): Promise<LiveLinkGreeting> {
  disconnect();
  return new Promise((resolve, reject) => {
    const mine = connectTo({ host: "127.0.0.1", port });
    socket = mine;
    let received = "", greeted = false;
    const fail = (reason: string) => {
      if (socket === mine) disconnect();
      else mine.destroy();
      reject(new Error(reason));
    };
    const timer = setTimeout(() => fail("no answer"), GIVE_UP_MS);

    mine.setNoDelay(true);
    mine.setEncoding("utf8");
    mine.on("connect", () => mine.write(`${JSON.stringify({ hello: HELLO, version: VERSION })}\n`));
    mine.on("data", (chunk: string) => {
      if (greeted) return;
      received += chunk;
      const end = received.indexOf("\n");
      if (end < 0) return;
      clearTimeout(timer);
      try {
        const reply = JSON.parse(received.slice(0, end)) as { hello?: string; version?: number; packs?: LiveLinkPack[]; features?: string[] };
        if (reply.hello !== HELLO || (reply.version ?? 0) > VERSION) { fail("not a live link this editor can use"); return; }
        greeted = true;
        // An older RumbleReShaded says nothing of features: it only does looks.
        resolve({ packs: reply.packs ?? [], features: Array.isArray(reply.features) ? reply.features : [] });
      } catch {
        fail("not a live link");
      }
    });
    mine.on("error", () => { clearTimeout(timer); if (!greeted) fail("not reachable"); });
    mine.on("close", () => {
      clearTimeout(timer);
      if (socket === mine) socket = null;
      if (greeted) closed();
      else fail("closed");
    });
  });
}

export function send({ looks, released, globals }: LiveLinkUpdate): void {
  const lines: object[] = [...looks.map(look => ({ look })), ...released.map(release => ({ release }))];
  if (globals && Object.keys(globals).length) lines.push({ globals });
  if (lines.length) socket?.write(lines.map(line => `${JSON.stringify(line)}\n`).join(""));
}
