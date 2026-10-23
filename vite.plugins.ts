// Vite plugins both builds of the page share (electron.vite.config.ts and vite.config.web.ts).
import type { Plugin } from "vite";

/**
 * index.html's Content-Security-Policy lets the page reach ws://localhost, for the dev server's hot
 * reload. Built pages have no dev server, so the desktop app and the website ship without it.
 */
export function noDevServerInCsp(): Plugin {
  return {
    name: "no-dev-server-in-csp",
    apply: "build",
    transformIndexHtml: html => html.replace(/ ws:\/\/localhost:\*/, ""),
  };
}
