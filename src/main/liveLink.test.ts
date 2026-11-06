import { createServer, type Server, type Socket } from "node:net";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { connect, disconnect, send } from "./liveLink";

let server: Server | null = null;

/** A stand-in for RumbleReShaded's end, answering a hello with `reply`, and collecting the lines it gets. */
async function game(reply: string) {
  const lines: string[] = [];
  let client: Socket | undefined;
  const listening = createServer(socket => {
    client = socket;
    socket.setEncoding("utf8");
    socket.on("error", () => {});
    socket.on("data", (text: string) => {
      for (const line of text.split("\n").filter(Boolean)) {
        lines.push(line);
        if (lines.length === 1 && reply) socket.write(`${reply}\n`);
      }
    });
  });
  server = listening;
  await new Promise<void>(resolve => listening.listen(0, "127.0.0.1", resolve));
  return { port: (listening.address() as AddressInfo).port, lines, drop: () => client!.destroy() };
}

afterEach(() => {
  disconnect();
  server?.close();
  server = null;
});

describe("the live link's connection", () => {
  it("says hello, reads the packs and features, and sends looks, releases and globals as lines", async () => {
    const { port, lines } = await game(JSON.stringify({ hello: "rrs-live-link", version: 1, features: ["globals"], packs: [{ id: "a", name: "A", parameters: [] }] }));
    expect(await connect(() => {}, port)).toEqual({ packs: [{ id: "a", name: "A", parameters: [] }], features: ["globals"] });
    send({ looks: [{ pack: "A", on: true, values: { x: 1 } }], released: ["B"], globals: { "basalt.beat": 0.5, "basalt.time": null } });
    await vi.waitFor(() => expect(lines).toHaveLength(4));
    expect(lines.map(line => JSON.parse(line))).toEqual([
      { hello: "rrs-live-link", version: 1 },
      { look: { pack: "A", on: true, values: { x: 1 } } },
      { release: "B" },
      { globals: { "basalt.beat": 0.5, "basalt.time": null } },
    ]);
  });

  it("takes an older game's link, which says nothing of features, as one for looks alone", async () => {
    const { port } = await game(JSON.stringify({ hello: "rrs-live-link", version: 1, packs: [] }));
    expect(await connect(() => {}, port)).toEqual({ packs: [], features: [] });
  });

  it("says when the game goes away", async () => {
    const { port, drop } = await game(JSON.stringify({ hello: "rrs-live-link", version: 1, packs: [] }));
    const closed = vi.fn();
    await connect(closed, port);
    drop();
    await vi.waitFor(() => expect(closed).toHaveBeenCalledOnce());
  });

  it("fails when nothing listens, or something else answers", async () => {
    const { port } = await game(JSON.stringify({ hello: "something else" }));
    await expect(connect(() => {}, port)).rejects.toThrow();
    server?.close();
    await expect(connect(() => {}, 1)).rejects.toThrow();
  });

  it("refuses a newer protocol", async () => {
    const { port } = await game(JSON.stringify({ hello: "rrs-live-link", version: 2 }));
    await expect(connect(() => {}, port)).rejects.toThrow();
  });
});
