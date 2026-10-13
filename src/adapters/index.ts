/**
 * Framework adapters: small helpers that turn a {@link Document} or an
 * {@link Envelope} into a response. They have no dependencies; the framework
 * objects are typed as `any`.
 *
 * | Framework | Import | Functions |
 * |---|---|---|
 * | Web `Response` | `@anzaui/engine` or `@anzaui/engine/adapters/web` | `htmlResponse(doc, status?, headers?)`, `jsonResponse(envelope, status?, headers?)`, `sseEvent(envelope)` |
 * | Hono | `@anzaui/engine/adapters/hono` | `html(c, doc, status?)`, `json(c, envelope, status?)`, plus the web helpers |
 * | Express | `@anzaui/engine/adapters/express` | `sendHtml(res, doc, status?)`, `sendJson(res, envelope, status?)`, `sendSse(res, envelope)` |
 * | Fastify | `@anzaui/engine/adapters/fastify` | `sendHtml(reply, doc, status?)`, `sendJson(reply, envelope, status?)` |
 *
 * `doc` may be a `Document` or a plain HTML string.
 *
 * @module
 */

/** Web-standard `Response` helpers, also importable from `@anzaui/engine/adapters/web`. */
export * as web from './web.js';
/** Hono helpers, also importable from `@anzaui/engine/adapters/hono`. */
export * as hono from './hono.js';
/** Express helpers, also importable from `@anzaui/engine/adapters/express`. */
export * as express from './express.js';
/** Fastify helpers, also importable from `@anzaui/engine/adapters/fastify`. */
export * as fastify from './fastify.js';

export { htmlResponse, jsonResponse, sseEvent } from './web.js';
