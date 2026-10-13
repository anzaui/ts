/**
 * Helpers that build a web-standard `Response`, for servers with a
 * `fetch(request)` handler such as Bun, Deno and Node.js 18+.
 *
 * The same functions are exported from the package root and as
 * `adapters.web`. The engine itself still needs `node:fs` and `node:crypto`,
 * so this runs on Node, Bun and Deno, not on filesystem-less edge runtimes.
 *
 * @example
 * ```ts
 * import { Fragment, Page, Setup } from '@anzaui/engine';
 * import { htmlResponse, jsonResponse } from '@anzaui/engine/adapters/web';
 *
 * const engine = await new Setup({ root: './templates' }).run();
 *
 * export default {
 *   async fetch(req: Request): Promise<Response> {
 *     const url = new URL(req.url);
 *     if (url.pathname === '/') return htmlResponse(await new Page('/', { title: 'Home' }).run(engine));
 *     if (url.pathname === '/card') return jsonResponse(await new Fragment('feed/card.html', 'feed', { title: 'Card' }).run(engine));
 *     return new Response('Not Found', { status: 404 });
 *   },
 * };
 * ```
 *
 * @module @anzaui/engine/adapters/web
 * @category Adapters
 */
import type { Document } from '../models/document.js';
import type { Envelope } from '../models/envelope.js';
import { formatEvent } from '../stream/sse.js';

/**
 * An HTML `Response` (`text/html; charset=utf-8`).
 *
 * @param document - A rendered {@link Document} or an HTML string.
 * @param status - HTTP status. Default 200.
 * @param headers - Extra headers; they can override `Content-Type`.
 * @returns The response.
 *
 * @example
 * ```ts
 * return htmlResponse(await new Page('/', { title: 'Home' }).run(engine));
 * ```
 *
 * @category Adapters
 */
export function htmlResponse(document: Document | string, status = 200, headers?: HeadersInit): Response {
  const body = typeof document === 'string' ? document : document.html;
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...headers,
    },
  });
}

/**
 * A JSON `Response` (`application/json; charset=utf-8`).
 *
 * @param envelope - An {@link Envelope} or any JSON-serializable value.
 * @param status - HTTP status. Default 200.
 * @param headers - Extra headers; they can override `Content-Type`.
 * @returns The response.
 *
 * @example
 * ```ts
 * return jsonResponse(await new Fragment('feed/card.html', 'feed', { title: 'Card' }).run(engine));
 * ```
 *
 * @category Adapters
 */
export function jsonResponse(envelope: Envelope | any, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(envelope), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

/**
 * Encode an envelope as an SSE message; the same function as {@link formatEvent}.
 *
 * @param envelope - The envelope to send.
 * @returns `"event: template\ndata: {…}\n\n"`.
 *
 * @category Adapters
 */
export function sseEvent(envelope: Envelope): string {
  return formatEvent(envelope);
}
