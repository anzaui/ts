import { AnzaError } from '../../errors/index.js';

/**
 * One piece of a parsed template.
 *
 * - `{ type: 'static', value }`: HTML text, written as is.
 * - `{ type: 'slot', name }`: a `{{name}}` placeholder (name trimmed, so
 *   `{{ user_name }}` is `user_name`); HTML-escaped when the engine runs with
 *   `escape: true`.
 * - `{ type: 'raw', name }`: a `{{{name}}}` placeholder, always inserted as is.
 *
 * @category Rendering
 */
export type Chunk =
  | {
      /** Static text. */
      type: 'static';
      /** The HTML text, written as is. */
      value: string;
    }
  /** `{{name}}`: HTML-escaped when the engine runs with `escape: true`. */
  | {
      /** A `{{name}}` placeholder. */
      type: 'slot';
      /** The trimmed placeholder name. */
      name: string;
    }
  /** `{{{name}}}`: always inserted as-is. */
  | {
      /** A `{{{name}}}` placeholder. */
      type: 'raw';
      /** The trimmed placeholder name. */
      name: string;
    };

/**
 * Split a template into static text and `{{slot}}` / `{{{raw}}}` chunks,
 * scanning the string once.
 *
 * @remarks
 * Placeholders are the whole syntax: there are no loops, conditionals,
 * filters, includes or comments.
 *
 * @param template - The template source.
 * @returns The chunks in order.
 * @throws {@link AnzaError} `TEMPLATE` for an unclosed `{{` or `{{{`, or an empty `{{}}`.
 *
 * @example
 * ```ts
 * import { extract } from '@anzaui/engine';
 *
 * extract('<b>{{title}}</b>{{{body}}}');
 * // [
 * //   { type: 'static', value: '<b>' },
 * //   { type: 'slot', name: 'title' },
 * //   { type: 'static', value: '</b>' },
 * //   { type: 'raw', name: 'body' },
 * // ]
 * ```
 *
 * @category Rendering
 */
export function extract(template: string): Chunk[] {
  const chunks: Chunk[] = [];
  let cursor = 0;
  const len = template.length;

  while (cursor < len) {
    const openIdx = template.indexOf('{{', cursor);
    if (openIdx === -1) {
      chunks.push({ type: 'static', value: template.slice(cursor) });
      break;
    }

    if (openIdx > cursor) {
      chunks.push({ type: 'static', value: template.slice(cursor, openIdx) });
    }

    const raw = template.charCodeAt(openIdx + 2) === 123; // '{'
    const open = raw ? 3 : 2;
    const close = raw ? '}}}' : '}}';
    const closeIdx = template.indexOf(close, openIdx + open);
    if (closeIdx === -1) {
      throw AnzaError.template(raw ? "Unclosed raw slot placeholder '{{{' in template" : "Unclosed slot placeholder '{{' in template");
    }

    const slotName = template.slice(openIdx + open, closeIdx).trim();
    if (!slotName) {
      throw AnzaError.template('Empty slot placeholder {{}} in template');
    }

    chunks.push(raw ? { type: 'raw', name: slotName } : { type: 'slot', name: slotName });
    cursor = closeIdx + close.length;
  }

  return chunks;
}
