// Reading form events. Inputs show the chart one-way (value={...}) and write back on "change" - when
// the field is left or Enter is pressed - so each edit is one undo step, not one per keystroke.

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export const text = (e: Event): string => (e.currentTarget as Field).value;
export const num = (e: Event): number => parseFloat(text(e));
export const checked = (e: Event): boolean => (e.currentTarget as HTMLInputElement).checked;
/** A number, or undefined for an empty or unreadable field - which removes the key. */
export const optionalNum = (e: Event): number | undefined => { const n = num(e); return Number.isNaN(n) ? undefined : n; };
