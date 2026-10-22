// The editor's file access in a plain browser (the web build, and `npm run dev:renderer`): the same
// EditorApi the desktop app's preload gives the page, done with file inputs, downloads and - on
// phones and tablets - the share sheet. main.ts installs it only when the preload has not, so the
// desktop app never runs any of this.
import type { EditorApi, OpenedFile, OpenedFolder } from "../../../shared/api";

/** A touch screen without a mouse: phones and tablets, where sharing beats downloading. */
const touchFirst = (): boolean => matchMedia("(pointer: coarse)").matches;

/**
 * Shows the browser's file picker. Resolves with the picked files, or [] when cancelled. The input
 * goes into the page while it is open: iOS Safari ignores a click on one that isn't.
 */
function pickFiles(setUp: (input: HTMLInputElement) => void): Promise<File[]> {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type = "file";
    input.style.display = "none";
    setUp(input);
    const done = (files: File[]) => { input.remove(); resolve(files); };
    input.addEventListener("change", () => done([...(input.files ?? [])]));
    input.addEventListener("cancel", () => done([]));
    document.body.append(input);
    input.click();
  });
}

const read = async (file: File, path: string): Promise<OpenedFile> => ({ path, bytes: new Uint8Array(await file.arrayBuffer()) });

/** A folder pick lists every file under it as "Folder/sub/file"; keep the files beside chart.json and in clips/, as the desktop app does. */
function chartFolderPath(relative: string): string | null {
  const parts = relative.split("/").slice(1);
  if (parts.length === 1) return parts[0];
  if (parts.length === 2 && parts[0].toLowerCase() === "clips") return parts.join("/");
  return null;
}

function download(name: string, bytes: Uint8Array): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart]));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const webApi: EditorApi = {
  async openFiles() {
    const files = await pickFiles(input => { input.multiple = true; });
    return Promise.all(files.map(f => read(f, f.name)));
  },

  async openFolder(): Promise<OpenedFolder | null> {
    const files = await pickFiles(input => { input.webkitdirectory = true; });
    if (!files.length) return null;
    const opened: OpenedFile[] = [];
    for (const f of files) {
      const path = chartFolderPath(f.webkitRelativePath || f.name);
      if (path) opened.push(await read(f, path));
    }
    // A page cannot write back into the folder it read, so it is no folder to save into: an empty
    // name leaves editor.folder falsy and Save asks where to save, as for loose files.
    return { folder: "", files: opened };
  },

  async saveChart(_folder, text) {
    download("chart.json", new TextEncoder().encode(text));
  },

  async saveFile(suggestedName, bytes) {
    if (touchFirst()) {
      const file = new File([bytes as BlobPart], suggestedName, { type: "application/octet-stream" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return suggestedName;
        } catch (e) {
          if ((e as Error).name === "AbortError") return null;
          // Anything else (say, the tap's permission ran out): download it instead.
        }
      }
    }
    download(suggestedName, bytes);
    return suggestedName;
  },

  async setTheme() { /* the browser draws its own frame */ },
};

/** Folder picking needs `webkitdirectory`, which phones don't offer. */
export const canOpenFolders = (): boolean => "webkitdirectory" in HTMLInputElement.prototype && !touchFirst();

/** True when the page is running on webApi rather than the desktop app's preload. */
export const inBrowser = (): boolean => window.editor === webApi;
