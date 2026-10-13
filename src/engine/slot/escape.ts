const SPECIAL = /[&<>"']/;
const SPECIAL_ALL = /[&<>"']/g;
const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/**
 * HTML-escape text, identically in all three engines: `&` `<` `>` `"` `'`
 * become `&amp;` `&lt;` `&gt;` `&quot;` `&#39;`. The result is safe in element
 * content and in quoted attribute values. Text without special characters is
 * returned unchanged.
 *
 * @remarks
 * **The engine does not escape by default.** Unless the engine runs with
 * `escape: true`, both `{{name}}` and `{{{name}}}` insert values as-is, so
 * run anything that comes from users through `escapeHtml` before binding it.
 * With `escape: true`, `{{name}}` values go through this function and
 * `{{{name}}}` values stay raw.
 *
 * @param text - The text to escape.
 * @returns The escaped text.
 *
 * @example
 * ```ts
 * import { escapeHtml } from '@anzaui/engine';
 *
 * escapeHtml('<script>alert("x")</script>');
 * // '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
 * tpl.bind({ comment: escapeHtml(userInput) });
 * ```
 *
 * @category Rendering
 */
export function escapeHtml(text: string): string {
  return SPECIAL.test(text) ? text.replace(SPECIAL_ALL, (c) => ENTITIES[c]) : text;
}
