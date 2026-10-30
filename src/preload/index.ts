import { contextBridge, ipcRenderer } from "electron";
import { Channels, type DesktopApi } from "../shared/api";

const api: DesktopApi = {
  openFiles: kind => ipcRenderer.invoke(Channels.openFiles, kind),
  openFolder: () => ipcRenderer.invoke(Channels.openFolder),
  saveChart: (folder, text) => ipcRenderer.invoke(Channels.saveChart, folder, text),
  saveFile: (suggestedName, bytes) => ipcRenderer.invoke(Channels.saveFile, suggestedName, bytes),
  setTheme: theme => ipcRenderer.invoke(Channels.setTheme, theme),
  chartsFolder: () => ipcRenderer.invoke(Channels.chartsFolder),
  listCharts: () => ipcRenderer.invoke(Channels.listCharts),
  readCover: (folder, name) => ipcRenderer.invoke(Channels.readCover, folder, name),
  readFolder: folder => ipcRenderer.invoke(Channels.readFolder, folder),
  duplicateFolder: folder => ipcRenderer.invoke(Channels.duplicateFolder, folder),
  createChartFolder: (chartName, files, difficulty) => ipcRenderer.invoke(Channels.createChartFolder, chartName, files, difficulty),
  renameChartFolder: (folder, chartName, difficulty) => ipcRenderer.invoke(Channels.renameChartFolder, folder, chartName, difficulty),
  saveFiles: (folder, files) => ipcRenderer.invoke(Channels.saveFiles, folder, files),
  trashFolder: folder => ipcRenderer.invoke(Channels.trashFolder, folder),
  recentFolders: () => ipcRenderer.invoke(Channels.recentFolders),
  askUnsaved: name => ipcRenderer.invoke(Channels.askUnsaved, name),
};

contextBridge.exposeInMainWorld("editor", api);
