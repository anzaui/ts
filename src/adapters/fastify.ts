/**
 * [Fastify](https://fastify.dev) helpers. The reply is typed as `any`, so
 * this module does not depend on Fastify. There is no SSE helper: write
 * `sseEvent(envelope)` to the raw response yourself.
 *
 * @example
 * ```ts
 * import Fastify from 'fastify';
 * import { Fragment, Page, Setup } from '@anzaui/engine';
 * import { sendHtml, sendJson } from '@anzaui/engine/adapters/fastify';
 *
 * const fastify = Fastify();
 * const engine = await new Setup({ root: './templates' }).run();
 *
 * fastify.get('/', async (request, reply) => sendHtml(reply, await new Page('/', { title: 'Fastify' }).run(engine)));
 * fastify.get('/card/:id', async (request, reply) => {
 *   const { id } = request.params as { id: string };
 *   return sendJson(reply, await new Fragment('feed/card.html', 'feed', { id }).run(engine));
 * });
 *
 * await fastify.listen({ port: 3000 });
 * ```
 *
 * @module @anzaui/engine/adapters/fastify
 * @category Adapters
 */
import type { Document } from '../models/document.js';
import type { Envelope } from '../models/envelope.js';

/**
 * Send a page with `text/html; charset=utf-8`.
 *
 * @param reply - The Fastify reply.
 * @param document - A rendered {@link Document} or an HTML string.
 * @param status - HTTP status. Default 200.
 * @returns The reply, so it can be returned from the handler.
 *
 * @category Adapters
 */
export function sendHtml(reply: any, document: Document | string, status = 200) {
  const body = typeof document === 'string' ? document : document.html;
  return reply.code(status).type('text/html; charset=utf-8').send(body);
}

/**
 * Send an envelope with `application/json; charset=utf-8`.
 *
 * @param reply - The Fastify reply.
 * @param envelope - An {@link Envelope} or any JSON-serializable value.
 * @param status - HTTP status. Default 200.
 * @returns The reply, so it can be returned from the handler.
 *
 * @category Adapters
 */
export function sendJson(reply: any, envelope: Envelope | any, status = 200) {
  return reply.code(status).type('application/json; charset=utf-8').send(envelope);
}
