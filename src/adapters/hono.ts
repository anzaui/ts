/**
 * [Hono](https://hono.dev) helpers. The context is typed as `any`, so this
 * module does not depend on Hono. It also re-exports the web helpers
 * (`htmlResponse`, `jsonResponse`, `sseEvent`). Because the engine reads
 * templates from disk, run Hono on Node, Bun or Deno.
 *
 * @example
 * ```ts
 * import { Hono } from 'hono';
 * import { stream } from 'hono/streaming';
 * import { Fragment, Page, Setup, escapeHtml } from '@anzaui/engine';
 * import { html, json, sseEvent } from '@anzaui/engine/adapters/hono';
 *
 * const engine = await new Setup({ root: './templates' }).run();
 * const app = new Hono();
 *
 * app.get('/', async (c) => html(c, await new Page('/', { title: 'Anza + Hono' }).run(engine)));
 *
 * app.get('/card/:id', async (c) => {
 *   const envelope = await new Fragment('feed/card.html', 'feed', {
 *     id: escapeHtml(c.req.param('id')), // values are not escaped unless `escape: true`
 *   }).run(engine);
 *   return json(c, envelope);
 * });
 *
 * app.get('/feed/stream', (c) => {
 *   c.header('Content-Type', 'text/event-stream');
 *   return stream(c, async (s) => {
 *     await s.write(sseEvent(await new Fragment('feed/card.html', 'feed', { title: 'Push' }).run(engine)));
 *   });
 * });
 *
 * export default app;
 * ```
 *
 * @module @anzaui/engine/adapters/hono
 * @category Adapters
 */
import type { Document } from '../models/document.js';
import type { Envelope } from '../models/envelope.js';
import { htmlResponse, jsonResponse, sseEvent } from './web.js';

export { htmlResponse, jsonResponse, sseEvent };

/**
 * Send a page through Hono's `c.html(body, status)`.
 *
 * @param c - The Hono context.
 * @param document - A rendered {@link Document} or an HTML string.
 * @param status - HTTP status. Default 200.
 * @returns Hono's response.
 *
 * @category Adapters
 */
export function html(c: any, document: Document | string, status = 200) {
  const body = typeof document === 'string' ? document : document.html;
  return c.html(body, status);
}

/**
 * Send an envelope through Hono's `c.json(value, status)`.
 *
 * @param c - The Hono context.
 * @param envelope - An {@link Envelope} or any JSON-serializable value.
 * @param status - HTTP status. Default 200.
 * @returns Hono's response.
 *
 * @category Adapters
 */
export function json(c: any, envelope: Envelope | any, status = 200) {
  return c.json(envelope, status);
}
