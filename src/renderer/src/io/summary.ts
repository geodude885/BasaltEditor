// What a chart card in "Your charts" shows: name, author, difficulty, how many projectiles, the song,
// the cover's bytes, and when it was made and last changed. Worked out from the chart and its files,
// wherever they are kept.
import * as Jsonc from "../model/jsonc";
import type { Chart } from "../model/types";
import { findCover } from "./files";

export type ChartSummary = {
  /** Where the chart is kept: a library entry's id, or a chart folder's path on the desktop. */
  id: string;
  name: string;
  author?: string;
  difficulty?: string;
  projectiles: number;
  song?: string;
  cover?: Uint8Array;
  created: number;
  updated: number;
};

/** A chart's summary, from the chart and the files beside it. */
export function summaryOf(id: string, chart: Partial<Chart>, files: Map<string, Uint8Array>, created: number, updated: number): ChartSummary {
  const coverKey = findCover(files, chart.cover);
  return {
    id, created, updated,
    name: chart.name || "Untitled", author: chart.author || undefined, difficulty: chart.difficulty || undefined,
    projectiles: (chart.events ?? []).filter(e => e?.projectile).length,
    song: chart.music?.file || undefined,
    cover: coverKey ? files.get(coverKey) : undefined,
  };
}

/** A summary from chart.json's text, as a folder keeps it. A chart that won't parse still gets a card. */
export function summaryOfText(id: string, text: string, files: Map<string, Uint8Array>, updated: number): ChartSummary {
  let chart: Partial<Chart> = {};
  try {
    const parsed = Jsonc.parse(text);
    if (parsed && typeof parsed === "object") chart = parsed as Partial<Chart>;
  } catch { /* summarised as untitled */ }
  const folderName = id.split(/[\\/]/).filter(Boolean).pop() ?? "Untitled";
  return { ...summaryOf(id, chart, files, updated, updated), name: chart.name || folderName };
}
