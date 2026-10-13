/**
 * [Express](https://expressjs.com) helpers. The response is typed as `any`,
 * so this module does not depend on Express.
 *
 * @example
 * ```ts
 * import express from 'express';
 * import { Fragment, Page, Setup } from '@anzaui/engine';
 * import { sendHtml, sendJson, sendSse } from '@anzaui/engine/adapters/express';
 *
 * const engine = await new Setup({ root: './templates' }).run();
 * const app = express();
 *
 * app.get('/', async (req, res) => sendHtml(res, await new Page('/', { title: 'Express' }).run(engine)));
 * app.get('/card', async (req, res) => sendJson(res, await new Fragment('feed/card.html', 'main', { status: 'online' }).run(engine)));
 *
 * app.get('/stream', (req, res) => {
 *   res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
 *   const timer = setInterval(async () => {
 *     sendSse(res, await new Fragment('feed/card.html', 'feed', { title: 'Live Update' }).run(engine));
 *   }, 2000);
 *   req.on('close', () => clearInterval(timer));
 * });
 *
 * app.listen(3000);
 * ```
 *
 * @module @anzaui/engine/adapters/express
 * @category Adapters
 */
import type { Document } from '../models/document.js';
import type { Envelope } from '../models/envelope.js';
import { formatEvent } from '../stream/sse.js';

/**
 * Send a page: `res.status(status).type('html').send(html)`.
 *
 * @param res - The Express response.
 * @param document - A rendered {@link Document} or an HTML string.
 * @param status - HTTP status. Default 200.
 * @returns Whatever `res.send` returns.
 *
 * @category Adapters
 */
export function sendHtml(res: any, document: Document | string, status = 200) {
  const body = typeof document === 'string' ? document : document.html;
  return res.status(status).type('html').send(body);
}

/**
 * Send an envelope as JSON: `res.status(status).json(envelope)`.
 *
 * @param res - The Express response.
 * @param envelope - An {@link Envelope} or any JSON-serializable value.
 * @param status - HTTP status. Default 200.
 * @returns Whatever `res.json` returns.
 *
 * @category Adapters
 */
export function sendJson(res: any, envelope: Envelope | any, status = 200) {
  return res.status(status).json(envelope);
}

/**
 * Write one SSE message ({@link formatEvent}) to an open event-stream response.
 * Set the `text/event-stream` headers yourself first.
 *
 * @param res - The Express response.
 * @param envelope - The envelope to push.
 *
 * @category Adapters
 */
export function sendSse(res: any, envelope: Envelope) {
  res.write(formatEvent(envelope));
}
