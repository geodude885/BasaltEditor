import { contextBridge, ipcRenderer } from "electron";
import { Channels, type EditorApi } from "../shared/api";

const api: EditorApi = {
  openFiles: kind => ipcRenderer.invoke(Channels.openFiles, kind),
  openFolder: () => ipcRenderer.invoke(Channels.openFolder),
  saveChart: (folder, text) => ipcRenderer.invoke(Channels.saveChart, folder, text),
  saveFile: (suggestedName, bytes) => ipcRenderer.invoke(Channels.saveFile, suggestedName, bytes),
  setTheme: theme => ipcRenderer.invoke(Channels.setTheme, theme),
};

contextBridge.exposeInMainWorld("editor", api);
