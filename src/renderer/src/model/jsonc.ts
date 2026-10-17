// JSON with comments: read it, and edit one top-level value in place. The chart's text is the source
// of truth - edits rewrite only the keys they touch, so comments and recorded clips elsewhere survive.

/** JSON with line and block comments and trailing commas, as the mod reads it. */
export function parse(text: string): unknown {
  let out = "", i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"') { const e = stringEnd(text, i); out += text.slice(i, e); i = e; }
    else if (text.startsWith("//", i)) { const e = text.indexOf("\n", i); i = e < 0 ? text.length : e; }
    else if (text.startsWith("/*", i)) { const e = text.indexOf("*/", i + 2); i = e < 0 ? text.length : e + 2; }
    else { out += c; i++; }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
}

function stringEnd(text: string, at: number): number {
  for (let i = at + 1; i < text.length; i++) {
    if (text[i] === "\\") i++;
    else if (text[i] === '"') return i + 1;
  }
  throw new Error("a string never ends");
}

function skip(text: string, at: number): number {
  while (at < text.length) {
    if (/\s/.test(text[at])) at++;
    else if (text.startsWith("//", at)) { const e = text.indexOf("\n", at); at = e < 0 ? text.length : e + 1; }
    else if (text.startsWith("/*", at)) { const e = text.indexOf("*/", at + 2); at = e < 0 ? text.length : e + 2; }
    else break;
  }
  return at;
}

function valueEnd(text: string, at: number): number {
  const c = text[at];
  if (c === '"') return stringEnd(text, at);
  if (c !== "{" && c !== "[") {
    let e = at;
    while (e < text.length && !/[\s,}\]]/.test(text[e]) && !text.startsWith("//", e) && !text.startsWith("/*", e)) e++;
    return e;
  }
  let depth = 0;
  for (let i = at; i < text.length; i++) {
    const d = text[i];
    if (d === '"') i = stringEnd(text, i) - 1;
    else if (text.startsWith("//", i)) { const e = text.indexOf("\n", i); i = (e < 0 ? text.length : e + 1) - 1; }
    else if (text.startsWith("/*", i)) { const e = text.indexOf("*/", i + 2); i = (e < 0 ? text.length : e + 2) - 1; }
    else if (d === "{" || d === "[") depth++;
    else if (d === "}" || d === "]") { depth--; if (depth === 0) return i + 1; }
  }
  throw new Error("a value is never closed");
}

/**
 * The text with top-level `name` set to `value` (or removed, for undefined) - the same edit the mod
 * makes, so comments elsewhere survive.
 */
export function set(text: string, name: string, value: unknown): string {
  const open = skip(text, 0);
  if (text[open] !== "{") throw new Error("a chart is a JSON object");
  let at = open + 1, lastEnd = -1;
  for (;;) {
    at = skip(text, at);
    const c = text[at];
    if (c === "}") {
      if (value === undefined) return text;
      const property = `\n  ${JSON.stringify(name)}: ${pretty(value, "  ")}`;
      if (lastEnd < 0) return text.slice(0, open + 1) + property + "\n" + text.slice(at);
      const after = skip(text, lastEnd);
      const comma = after < at && text[after] === ",";
      const insert = comma ? after + 1 : lastEnd;
      return text.slice(0, insert) + (comma ? "" : ",") + text.slice(insert, at).trimEnd() + property + "\n" + text.slice(at);
    }
    if (c === ",") { at++; continue; }
    if (c !== '"') throw new Error("expected a property name");
    const keyStart = at, keyEnd = stringEnd(text, at);
    const key = JSON.parse(text.slice(at, keyEnd)) as string;
    const colon = skip(text, keyEnd);
    const start = skip(text, colon + 1);
    const end = valueEnd(text, start);
    if (key.toLowerCase() === name.toLowerCase()) {
      if (value !== undefined) return text.slice(0, start) + pretty(value, "  ") + text.slice(end);
      return remove(text, keyStart, end, lastEnd);
    }
    lastEnd = end; at = end;
  }
}

/**
 * The text without the property spanning keyStart..end and the comma that went with it. A comment on
 * the property's own line goes with it; comments on other lines stay.
 */
function remove(text: string, keyStart: number, end: number, previousEnd: number): string {
  const lineStart = text.lastIndexOf("\n", keyStart - 1) + 1;
  const ownLine = text.slice(lineStart, keyStart).trim() === "";
  const after = skip(text, end);
  if (text[after] === ",") {
    // Not the last (or a trailing comma): take it, its comma and, when it had the line to itself, the line.
    let cut = after + 1;
    while (text[cut] === " " || text[cut] === "\t") cut++;
    if (text.startsWith("//", cut)) { const e = text.indexOf("\n", cut); cut = e < 0 ? text.length : e; }
    if (text[cut] === "\r") cut++;
    const wholeLine = ownLine && text[cut] === "\n";
    return text.slice(0, wholeLine ? lineStart : keyStart) + text.slice(wholeLine ? cut + 1 : cut);
  }
  // The last: take the comma before it instead, keeping whatever sits between.
  const from = ownLine ? lineStart : keyStart;
  const comma = previousEnd < 0 ? -1 : text.indexOf(",", previousEnd);
  if (comma < 0 || comma >= keyStart) return text.slice(0, from).trimEnd() + text.slice(end);
  return text.slice(0, comma) + text.slice(comma + 1, from).trimEnd() + text.slice(end);
}

/** Compact where it reads well: short objects on one line, lists one item per line. */
export function pretty(value: unknown, indent: string): string {
  const flat = JSON.stringify(value);
  if (flat.length <= 90 || (!Array.isArray(value) && (typeof value !== "object" || value === null))) {
    return flat.replace(/":/g, '": ').replace(/,"/g, ', "').replace(/^\{/, "{ ").replace(/\}$/, " }").replace(/\{ \}/g, "{}");
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return "[\n" + value.map(v => indent + "  " + pretty(v, indent + "  ")).join(",\n") + "\n" + indent + "]";
  }
  const entries = Object.entries(value as object).map(([k, v]) => `${indent}  ${JSON.stringify(k)}: ${pretty(v, indent + "  ")}`);
  return "{\n" + entries.join(",\n") + "\n" + indent + "}";
}
