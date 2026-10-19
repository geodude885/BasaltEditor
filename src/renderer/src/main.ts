import "./store/renamed";
import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";
import { appearance } from "./store/appearance.svelte";

appearance.start();

export default mount(App, { target: document.getElementById("app")! });
