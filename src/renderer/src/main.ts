import "./store/renamed";
import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";
import { appearance } from "./store/appearance.svelte";
import { layout } from "./store/layout.svelte";
import { webLibrary } from "./platform/library-web";
import { canOpenFolders, inBrowser, webApi } from "./platform/web";
import { platform } from "./store/commands";
import { library } from "./store/library.svelte";

// The desktop app's preload provides window.editor; in a plain browser, the web version stands in.
window.editor ??= webApi;
platform.canOpenFolders = !inBrowser() || canOpenFolders();
// Your charts live in the browser's storage on the web; the desktop app has its Charts folder.
if (inBrowser() && "indexedDB" in window) library.start(webLibrary);

appearance.start();
layout.start();

export default mount(App, { target: document.getElementById("app")! });
