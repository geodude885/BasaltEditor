import "./store/renamed";
import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";
import { appearance } from "./store/appearance.svelte";
import { webApi } from "./platform/web";

// The desktop app's preload provides window.editor; in a plain browser, the web version stands in.
window.editor ??= webApi;

appearance.start();

export default mount(App, { target: document.getElementById("app")! });
