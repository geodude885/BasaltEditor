// Which layout the page uses: the desktop workbench, or the compact one for phones (a touch screen
// whose short side is phone-sized). `?mobile=1` forces the compact layout - for trying it with a
// mouse - and `?mobile=0` forces the desktop one.

const PHONE_SHORT_SIDE_PIXELS = 600;

function forced(): boolean | null {
  try {
    const value = new URLSearchParams(location.search).get("mobile");
    return value === "1" ? true : value === "0" ? false : null;
  } catch { return null; }
}

class Layout {
  /** The phone layout: a fixed shell that never scrolls as a page. */
  compact = $state(false);
  /** Wider than tall. The phone layout is laid out for this first; portrait stacks the same pieces. */
  landscape = $state(true);

  /** Reads the screen now and whenever it turns or resizes. main.ts calls it once. */
  start(): void {
    const coarse = matchMedia("(pointer: coarse)");
    const update = () => {
      const w = window.innerWidth, h = window.innerHeight;
      this.compact = forced() ?? (coarse.matches && Math.min(w, h) <= PHONE_SHORT_SIDE_PIXELS);
      this.landscape = w >= h;
    };
    update();
    window.addEventListener("resize", update);
    coarse.addEventListener("change", update);
  }
}

export const layout = new Layout();
