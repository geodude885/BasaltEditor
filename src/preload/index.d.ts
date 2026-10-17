import type { EditorApi } from "../shared/api";

declare global {
  interface Window {
    /** The desktop app's file access - see src/shared/api.ts. */
    editor: EditorApi;
  }
}
