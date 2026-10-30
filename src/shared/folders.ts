// What a chart's folder in the game's Charts folder is called. The editor names folders the way the mod
// does (ChartFiles.FileStem, ChartTemplate): lower case, a hyphen for each space or character a folder
// name can't hold, `-2`, `-3`... when one is taken - with the difficulty after the name, so one song's
// charts stay apart. Shared by the main process, which makes and renames folders, and the page.

// Characters no folder name may hold on Windows, macOS or Linux.
const INVALID = /[<>:"/\\|?*\0-\x1f]/g;
const LONGEST = 80;

/** A chart's folder name from its name and difficulty: "Fight!" on Hard is "fight!-hard". */
export function chartFolderName(name: string, difficulty?: string): string {
  const stem = (part: string) => part.trim().replace(INVALID, "-").replace(/ /g, "-").toLowerCase();
  const joined = [name, difficulty].filter(part => part?.trim()).map(part => stem(part!)).join("-");
  // Windows refuses a name that ends in a dot or space.
  return joined.slice(0, LONGEST).replace(/[. ]+$/, "") || "chart";
}

/** The candidates for a folder named `wanted`, in order: itself, then `wanted-2`, `wanted-3`... */
export function* freeNames(wanted: string): Generator<string> {
  yield wanted;
  for (let n = 2; ; n++) yield `${wanted}-${n}`;
}

/** A folder name without a number added to make it free: "fight!-hard-2" and "My Chart (2)" as "fight!-hard" and "My Chart". */
const withoutNumber = (folder: string): string => folder.replace(/(-\d+| \(\d+\))$/, "");

/**
 * Whether a folder's name is one the editor or the mod would have given a chart of this name and
 * difficulty - so it may follow the chart when it's renamed. A folder named anything else was named by
 * hand, and is left alone. Older editors named folders after the chart's name as it is.
 */
export function folderNamedAfter(folder: string, name: string, difficulty?: string): boolean {
  // A name that ends in a number ("Track 2") is tried as it is too, not only without it.
  const bases = [folder, withoutNumber(folder)].map(base => base.toLowerCase());
  const older = name.replace(INVALID, "").replace(/[. ]+$/, "").trim().slice(0, LONGEST).toLowerCase();
  return [chartFolderName(name, difficulty), chartFolderName(name), older].some(named => bases.includes(named));
}
