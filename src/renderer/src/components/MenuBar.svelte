<script lang="ts">
  // The desktop layout's menu bar: File, Edit, View and Playback, drawn from the command table. Click
  // a menu (or press Alt or F10, then the arrows) to open it; while one is open, pointing at another
  // opens that instead. Enter or a click runs a command; Escape or a click elsewhere closes.
  import { drop } from "./motion";
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import { menus, visibleGroups, type Command, type MenuId } from "../store/commands";

  const all = $derived(menus());
  let open = $state<MenuId | null>(null);
  let bar: HTMLElement;

  const tops = () => [...bar.querySelectorAll<HTMLButtonElement>(":scope > .menu > .top")];
  const items = () => [...bar.querySelectorAll<HTMLButtonElement>(".drop [role^=menuitem]:not(:disabled)")];

  async function show(id: MenuId | null, focus: "top" | "first" | "last" | "none" = "none"): Promise<void> {
    open = id;
    await tick();
    const index = all.findIndex(m => m.id === id);
    if (focus === "top" && index >= 0) tops()[index]?.focus();
    if (focus === "first") items()[0]?.focus();
    if (focus === "last") items().at(-1)?.focus();
  }

  function run(command: Command): void {
    open = null;
    void command.run();
  }

  /** The menu `step` along from the one open (or focused), round the ends. */
  function along(step: number): MenuId {
    const focused = tops().indexOf(document.activeElement as HTMLButtonElement);
    const from = open ? all.findIndex(m => m.id === open) : Math.max(0, focused);
    return all[(from + step + all.length) % all.length].id;
  }

  function keydown(ev: KeyboardEvent): void {
    const list = items(), at = list.indexOf(document.activeElement as HTMLButtonElement);
    switch (ev.key) {
      case "ArrowRight": case "ArrowLeft": {
        const next = along(ev.key === "ArrowRight" ? 1 : -1);
        if (open) void show(next, "first");
        else tops()[all.findIndex(m => m.id === next)]?.focus();
        break;
      }
      case "ArrowDown":
        if (!open) void show(along(0), "first");
        else list[(at + 1) % list.length]?.focus();
        break;
      case "ArrowUp":
        if (!open) void show(along(0), "last");
        else list[(at - 1 + list.length) % list.length]?.focus();
        break;
      case "Escape": {
        const index = all.findIndex(m => m.id === open);
        if (open) { open = null; tops()[index]?.focus(); }
        else (document.activeElement as HTMLElement)?.blur();
        break;
      }
      case "Tab":
        open = null;
        return;
      default:
        return;
    }
    // Handled here: the editor's own shortcuts leave it alone.
    ev.preventDefault();
    ev.stopPropagation();
  }

  // Alt on its own (pressed and let go with nothing else), or F10, goes to the menu bar - or leaves it.
  let altAlone = false;
  function windowKeydown(ev: KeyboardEvent): void {
    altAlone = ev.key === "Alt" && !ev.ctrlKey && !ev.shiftKey && !ev.metaKey;
    if (ev.key === "F10" && !ev.shiftKey) { ev.preventDefault(); toggleFocus(); }
  }
  function windowKeyup(ev: KeyboardEvent): void {
    if (ev.key === "Alt" && altAlone) { ev.preventDefault(); toggleFocus(); }
    altAlone = false;
  }
  function toggleFocus(): void {
    if (bar.contains(document.activeElement)) { open = null; (document.activeElement as HTMLElement).blur(); }
    else tops()[0]?.focus();
  }

  function windowPointerdown(ev: PointerEvent): void {
    if (open && !bar.contains(ev.target as Node)) open = null;
  }
</script>

<svelte:window onkeydown={windowKeydown} onkeyup={windowKeyup} onpointerdown={windowPointerdown} onblur={() => { open = null; }} />

<div class="menubar" role="menubar" tabindex="-1" aria-label="Menus" bind:this={bar} onkeydown={keydown}>
  {#each all as menu (menu.id)}
    <div class="menu">
      <button class="top" class:on={open === menu.id} role="menuitem" aria-haspopup="menu" aria-expanded={open === menu.id}
        onclick={() => show(open === menu.id ? null : menu.id)}
        onpointerenter={() => { if (open && open !== menu.id) void show(menu.id); }}>{menu.label}</button>
      {#if open === menu.id}
        <div class="drop" role="menu" aria-label={menu.label} in:drop>
          {#each visibleGroups(menu) as group, g (g)}
            {#if g}<div class="sep" role="separator"></div>{/if}
            {#each group as command (command.id)}
              {@const checked = command.checked?.()}
              <button role={checked === undefined ? "menuitem" : "menuitemcheckbox"} aria-checked={checked}
                disabled={command.enabled ? !command.enabled() : false} onclick={() => run(command)}
                onpointerenter={ev => ev.currentTarget.focus()}>
                <span class="tick">{#if checked}<Icon name="check" size="12px" />{/if}</span>
                <span class="label">{command.label}</span>
                {#if command.keys}<kbd>{command.keys}</kbd>{/if}
              </button>
            {/each}
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .menubar { display: flex; align-items: center; gap: 2px; }
  .menu { position: relative; }
  .top { border: 0; background: none; padding: 6px 10px; font: 600 14px var(--display); letter-spacing: .06em; text-transform: uppercase; color: var(--text-dim); }
  .top:hover, .top.on, .top:focus-visible { background: var(--raised); color: var(--text); }
  .drop {
    position: absolute; top: calc(100% + 4px); left: 0; z-index: 20; min-width: 260px; padding: 4px; display: grid;
    background: var(--panel); border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 8px 24px var(--shadow);
  }
  .drop button {
    display: grid; grid-template-columns: 16px 1fr auto; gap: 8px; align-items: center; text-align: left;
    border: 0; background: none; padding: 6px 8px; border-radius: 5px; color: var(--text); font-size: 13px; white-space: nowrap;
  }
  .drop button:focus { outline: none; background: var(--raised); }
  .drop button:disabled { color: var(--text-dim); opacity: .55; }
  .tick { display: flex; color: var(--accent); }
  kbd { font: 11px var(--mono); color: var(--text-dim); }
  .sep { height: 1px; margin: 4px 6px; background: var(--line); }
</style>
