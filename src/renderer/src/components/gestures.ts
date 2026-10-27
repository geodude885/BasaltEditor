// Swipes on the phone layout's panels, as Svelte actions: `use:dismissable` lets a panel be dragged
// away to close (it follows the finger, then closes or springs back), `use:edgeSwipe` opens the menu
// from the left edge. The deciding is in views/swipe.ts. Touch only: a mouse keeps its buttons.
//
// The browser decides which drags it keeps for scrolling by `touch-action`, combined only up to the
// nearest scrolling element - so a panel's scrolling content needs `touch-action: pan-y` itself (or
// `none` for a handle), or sideways drags on it are taken as scrolls and never arrive here.
//
// A panel closed by a drag carries on from where the finger let go: the drag leaves where it got to
// on the element (data-flung-*), and motion.ts's leaving transitions start from there.
import { DismissDrag, EdgeSwipe, type Axis, type Toward } from "../views/swipe";

export type DismissOptions = {
  axis: Axis;
  /** Which way closes it: +1 right or down, -1 left or up, 0 either way. */
  toward: Toward;
  onClose: () => void;
  /** Only presses that start inside this (a selector within the panel) drag it - say, its header. */
  handle?: string;
  /** Off for now (say, in a layout where it doesn't apply). */
  disabled?: boolean;
};

/**
 * Presses on these never drag a panel: they drag themselves (sliders, text being selected), or say
 * so. Other fields only react to taps, so a swipe starting on one still moves the panel - the
 * settings drawer is mostly fields, and must stay easy to grab.
 */
const KEEPS_ITS_OWN = "input[type=range], textarea, [data-no-swipe]";

/** After a drag, the click it would end in is swallowed - only that one. */
function swallowNextClick(): void {
  const swallow = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
  window.addEventListener("click", swallow, { capture: true, once: true });
  setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 80);
}

export function dismissable(node: HTMLElement, options: DismissOptions) {
  let opts = options, drag: DismissDrag | null = null, pointer = -1;

  function down(ev: PointerEvent): void {
    if (opts.disabled || drag || ev.pointerType === "mouse" || !ev.isPrimary) return;
    const target = ev.target instanceof Element ? ev.target : null;
    if (target?.closest(KEEPS_ITS_OWN)) return;
    if (opts.handle && !target?.closest(opts.handle)) return;
    drag = new DismissDrag(opts.axis, opts.toward, ev.clientX, ev.clientY);
    pointer = ev.pointerId;
  }

  function move(ev: PointerEvent): void {
    if (!drag || ev.pointerId !== pointer) return;
    if (!drag.move(ev.clientX, ev.clientY, ev.timeStamp)) {
      if (drag.locked === "ignore") drag = null;
      return;
    }
    if (!node.hasPointerCapture(pointer)) node.setPointerCapture(pointer);
    node.style.transition = "none";
    node.style.transform = `translate${opts.axis.toUpperCase()}(${drag.offset}px)`;
  }

  function up(ev: PointerEvent): void {
    if (!drag || ev.pointerId !== pointer) return;
    const done = drag;
    drag = null;
    if (done.locked !== "drag") return;
    swallowNextClick();
    const size = opts.axis === "x" ? node.offsetWidth : node.offsetHeight;
    if (ev.type === "pointerup" && done.closes(size)) {
      node.dataset.flungAxis = opts.axis;
      node.dataset.flungPx = String(done.offset);
      opts.onClose();
      return;
    }
    // Not far or fast enough: spring back.
    node.style.transition = "transform 180ms cubic-bezier(.2, .9, .3, 1)";
    node.style.transform = "";
    const settle = () => { node.style.transition = ""; };
    node.addEventListener("transitionend", settle, { once: true });
    setTimeout(settle, 250);
  }

  node.addEventListener("pointerdown", down);
  node.addEventListener("pointermove", move);
  node.addEventListener("pointerup", up);
  node.addEventListener("pointercancel", up);
  return {
    update(next: DismissOptions) { opts = next; },
    destroy() {
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", up);
    },
  };
}

/** Running from the home screen, where no back swipe competes for the edge, so it can be wider. */
const standalone = (): boolean =>
  (typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches)
  || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export type EdgeSwipeOptions = {
  onOpen: () => void;
  /** Not now - say, with the menu already open. */
  disabled?: boolean;
};

/**
 * Swiping right from the left edge of `node` opens something (the menu). Presses on anything marked
 * `data-swipe-open` (the rail) count too, so it still works where the system takes the screen's edge.
 * Listens before the canvases do, without taking their presses unless it opens.
 */
export function edgeSwipe(node: HTMLElement, options: EdgeSwipeOptions) {
  let opts = options, swipe: EdgeSwipe | null = null, pointer = -1;

  function down(ev: PointerEvent): void {
    if (opts.disabled || ev.pointerType === "mouse" || !ev.isPrimary) return;
    const box = node.getBoundingClientRect(), inset = parseFloat(getComputedStyle(node).paddingLeft) || 0;
    const fromEdge = ev.clientX - box.left - inset, zone = standalone() ? 28 : 16;
    const onOpener = ev.target instanceof Element && !!ev.target.closest("[data-swipe-open]");
    if (fromEdge > zone && !onOpener) return;
    swipe = new EdgeSwipe(ev.clientX, ev.clientY);
    pointer = ev.pointerId;
  }

  function move(ev: PointerEvent): void {
    if (!swipe || ev.pointerId !== pointer) return;
    const now = swipe.move(ev.clientX, ev.clientY);
    if (now === "wait") return;
    swipe = null;
    if (now === "open") { swallowNextClick(); opts.onOpen(); }
  }

  const end = (ev: PointerEvent) => { if (ev.pointerId === pointer) swipe = null; };
  // Capture: the canvases take their pointer as it goes down, and must not hide it from this.
  node.addEventListener("pointerdown", down, { capture: true });
  node.addEventListener("pointermove", move, { capture: true });
  node.addEventListener("pointerup", end, { capture: true });
  node.addEventListener("pointercancel", end, { capture: true });
  return {
    update(next: EdgeSwipeOptions) { opts = next; },
    destroy() {
      node.removeEventListener("pointerdown", down, { capture: true });
      node.removeEventListener("pointermove", move, { capture: true });
      node.removeEventListener("pointerup", end, { capture: true });
      node.removeEventListener("pointercancel", end, { capture: true });
    },
  };
}
