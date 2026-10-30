import { describe, expect, it } from "vitest";
import { chartFolderName, folderNamedAfter, freeNames } from "./folders";

describe("chart folder names", () => {
  it("are the mod's way, with the difficulty after the name", () => {
    expect(chartFolderName("Fight!", "Hard")).toBe("fight!-hard");
    expect(chartFolderName("My Chart")).toBe("my-chart");
    expect(chartFolderName("Frog Summer", "  ")).toBe("frog-summer");
    expect(chartFolderName('a/b: "c"?', "Expert")).toBe("a-b---c---expert");
    expect(chartFolderName("ends with dots...")).toBe("ends-with-dots");
    expect(chartFolderName("   ")).toBe("chart");
  });

  it("take a number when taken, as the mod does", () => {
    const names = freeNames("fight!-hard");
    expect([names.next().value, names.next().value, names.next().value]).toEqual(["fight!-hard", "fight!-hard-2", "fight!-hard-3"]);
  });

  it("follow a chart only from a folder named after it, by the editor, the mod or an older editor", () => {
    expect(folderNamedAfter("my-chart", "My Chart")).toBe(true);
    expect(folderNamedAfter("my-chart-3", "My Chart")).toBe(true);
    expect(folderNamedAfter("My Chart (2)", "My Chart")).toBe(true);
    expect(folderNamedAfter("fight!-hard", "Fight!", "Hard")).toBe(true);
    expect(folderNamedAfter("Fight!", "Fight!", "Hard")).toBe(true);
    expect(folderNamedAfter("track-2", "Track 2")).toBe(true);
    expect(folderNamedAfter("Boss songs", "Fight!", "Hard")).toBe(false);
    expect(folderNamedAfter("fight!-easy", "Fight!", "Hard")).toBe(false);
  });
});
