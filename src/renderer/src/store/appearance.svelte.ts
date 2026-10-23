// Light or dark: the page's colours come from app.css by <html data-theme>, the canvases read them
// through views/theme.ts, and the desktop app's frame and dialogs follow along.
import { followTheme } from "./files";

export type ThemeChoice = "system" | "dark" | "light";
export type Scheme = "dark" | "light";

export const THEME_CHOICES: ThemeChoice[] = ["system", "dark", "light"];
/** Each choice as the theme pickers name it. */
export const THEME_NAMES: Record<ThemeChoice, string> = { system: "System theme", dark: "Basalt (dark)", light: "Ash (light)" };
const THEME_KEY = "basalt-theme";

function savedChoice(): ThemeChoice {
  try { const v = localStorage.getItem(THEME_KEY); if (THEME_CHOICES.includes(v as ThemeChoice)) return v as ThemeChoice; } catch { /* system */ }
  return "system";
}

class Appearance {
  choice = $state<ThemeChoice>(savedChoice());
  systemDark = $state(true);
  /** What is showing: the choice, with "system" settled. */
  readonly scheme: Scheme = $derived(this.choice === "system" ? (this.systemDark ? "dark" : "light") : this.choice);

  /** Applies the theme and follows the system's setting from now on. Called once, before the page mounts. */
  start(): void {
    const query = matchMedia("(prefers-color-scheme: dark)");
    this.systemDark = query.matches;
    query.addEventListener("change", e => { this.systemDark = e.matches; this.apply(); });
    this.apply();
  }

  choose(choice: ThemeChoice): void {
    this.choice = choice;
    try { localStorage.setItem(THEME_KEY, choice); } catch { /* not remembered */ }
    this.apply();
  }

  // Straight away, not in an effect: canvases redraw when the scheme changes and must find the new colours there.
  private apply(): void {
    document.documentElement.dataset.theme = this.scheme;
    followTheme(this.choice);
  }
}

export const appearance = new Appearance();
