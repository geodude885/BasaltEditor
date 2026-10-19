// Refreshes what this editor takes from the mod and the game:
//   schema/chart.schema.json  <- the mod's docs/chart.schema.json, and the types generated from it
//   data/structures.json      <- the game's structure sizes, written by the mod's =measure self-test
//   data/packs/*.json         <- the shader packs' manifests, from RumbleBossBattlesShaders
// All are committed, so the editor builds without the mod or the game; run this when either changes.
//
// usage: npm run sync [-- --mod <Basalt folder>] [-- --game <RUMBLE folder>] [-- --shaders <RumbleBossBattlesShaders folder>]
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { compile } from "json-schema-to-typescript";

const root = resolve(import.meta.dirname, "..");
const { values } = parseArgs({ options: { mod: { type: "string" }, game: { type: "string" }, shaders: { type: "string" } } });
const mod = resolve(values.mod ?? resolve(root, "../Basalt"));
const game = resolve(values.game ?? "C:/Program Files (x86)/Steam/steamapps/common/RUMBLE");
const shaders = resolve(values.shaders ?? resolve(root, "../RumbleBossBattlesShaders"));
const packsTheEditorKnows = ["BossBattlesStage"];

async function refresh(from, to) {
  if (existsSync(from)) { await copyFile(from, to); console.log(`copied ${from}`); }
  else console.warn(`${from} not found - keeping the committed copy`);
}

await refresh(resolve(mod, "docs/chart.schema.json"), resolve(root, "schema/chart.schema.json"));
await refresh(resolve(game, "UserData/Basalt/SelfTest/structures.json"), resolve(root, "data/structures.json"));
await mkdir(resolve(root, "data/packs"), { recursive: true });
for (const pack of packsTheEditorKnows) {
  await refresh(resolve(shaders, `Assets/PackSource/${pack}/manifest.json`), resolve(root, `data/packs/${pack}.json`));
}

const schema = JSON.parse(await readFile(resolve(root, "schema/chart.schema.json"), "utf8"));
const ts = await compile(schema, "Chart", {
  bannerComment: "/* Generated from schema/chart.schema.json by scripts/sync-mod-data.mjs - do not edit. */",
  additionalProperties: false,
  strictIndexSignatures: true,
});
await writeFile(resolve(root, "src/renderer/src/model/chart.gen.ts"), ts);
console.log("wrote src/renderer/src/model/chart.gen.ts");
