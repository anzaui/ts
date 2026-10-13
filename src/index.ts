/**
 * Server-templated UI (STUI) for Node.js, Bun and Deno: full HTML pages for
 * the first load, and JSON **envelopes** (`{ v: 2, slot, ts, html, sig?, css? }`)
 * for fragments, fetches and SSE / WebSocket pushes, optionally signed with
 * HMAC-SHA256 or Ed25519.
 *
 * The behaviour (template names, page resolution, value conversion, escaping,
 * the envelope format, signature v2 and error codes) is shared with the Rust
 * and Python engines and specified in the
 * [Engine Contract](https://github.com/anzaui/anza/blob/main/docs/engines/contract.md).
 *
 * ```text
 * ┌─────────────────┐   Full page (HTML, open DSD)            ┌─────────────────┐
 * │  Node / Bun /   ├────────────────────────────────────────►│     Browser     │
 * │  Deno server    │   Envelopes over fetch / SSE / WS       │ (custom elements│
 * │ (@anzaui/engine)├────────────────────────────────────────►│  + your code)   │
 * └─────────────────┘   { v, slot, ts, html, sig? }           └─────────────────┘
 * ```
 *
 * ## Quick start
 *
 * ```bash
 * npm install @anzaui/engine
 * ```
 *
 * ```ts
 * import { Setup, Page, Fragment, verifyEnvelope } from '@anzaui/engine';
 *
 * // 1. Load and parse ./templates once; check the signing key.
 * const engine = await new Setup({
 *   root: './templates',
 *   signing: { mode: 'hmac', secret: process.env.ANZA_SECRET! }, // at least 32 bytes
 * }).run();
 *
 * // 2. Full page: templates/pages/home.html inside templates/layout/shell.html.
 * const doc = await new Page('/', { title: 'Home Page' }).run(engine);
 *
 * // 3. Signed fragment envelope from templates/feed/card.html.
 * const envelope = await new Fragment('feed/card.html', 'feed', { title: 'Live update' }).run(engine);
 *
 * // 4. Whoever relays the envelope can check it.
 * verifyEnvelope({ mode: 'hmac', secret: process.env.ANZA_SECRET! }, envelope, { maxAgeSecs: 60, slot: 'feed' });
 * ```
 *
 * ## Guide
 *
 * - **Engine**: {@link Setup} loads the template root and validates keys,
 *   giving an {@link Engine}. The template layout (`layout/shell.html`,
 *   `pages/…`, fragments) is described on {@link Setup}.
 * - **Rendering**: {@link Page} returns a full HTML {@link Document};
 *   {@link Fragment} returns an {@link Envelope}. Templates use only
 *   `{{name}}` and `{{{name}}}` placeholders ({@link extract},
 *   {@link compile}); values are converted with {@link stringify}.
 * - **Signing**: {@link SignOptions}, {@link Signer}, the v2 message
 *   ({@link signatureMessage}) and {@link verifyEnvelope}. Low-level helpers
 *   live in the {@link crypto} namespace.
 * - **Streaming**: {@link Stream}, {@link formatEvent} (SSE) and
 *   {@link formatPacket} (WebSocket).
 * - **Adapters**: {@link htmlResponse} / {@link jsonResponse} for
 *   web-standard `Response`s, and the Hono, Express and Fastify helpers
 *   (`@anzaui/engine/adapters/*`, also the {@link adapters} namespace).
 * - **Errors**: everything throws {@link AnzaError} with an {@link ErrorCode}.
 *
 * ## Security
 *
 * - **No auto-escaping by default.** `{{name}}` and `{{{name}}}` insert
 *   values as-is unless the engine runs with `escape: true`. Escape anything
 *   that comes from users with {@link escapeHtml} before binding it, or set
 *   `escape: true` so `{{name}}` is escaped and only `{{{name}}}` is raw.
 * - **Keys are checked at setup.** A missing or short HMAC secret (under 32
 *   bytes) or a malformed Ed25519 key makes {@link Setup.run} throw `CRYPTO`;
 *   the engine never falls back to unsigned envelopes, and never prints keys.
 * - **Signature v2** covers `ts`, `slot`, `html` and `css` in a
 *   length-prefixed, domain-separated message ({@link signatureMessage}).
 * - **Verify on receipt** with {@link verifyEnvelope}: it checks the version,
 *   freshness, the target slot and the signature in constant time. The Anza
 *   browser library does not verify signatures for you.
 * - **Request input never reaches the filesystem.** Templates are loaded once;
 *   lookups are validated names in an in-memory cache ({@link validName}).
 *
 * @packageDocumentation
 * @module @anzaui/engine
 * @mergeModuleWith <project>
 */

export * from './errors/index.js';
export * from './models/index.js';
export * from './data/in/index.js';
export * from './engine/cache/engine.js';
export * from './engine/file/load.js';
export * from './engine/slot/index.js';
export { validName, pageTemplate, fragmentAllowed } from './engine/name.js';
export * from './stream/index.js';
/**
 * Signing and verification primitives: SHA-256 digests, HMAC-SHA256,
 * Ed25519, HKDF-SHA256 and strict hex, plus the {@link Signer} and envelope
 * signature helpers.
 * @category Signing
 */
export * as crypto from './crypto/index.js';
export { verifyEnvelope, signatureMessage, ENVELOPE_VERSION, type VerifyKey, type VerifyOptions, type ReceivedEnvelope } from './crypto/envelope.js';
export { Signer, type SignOptions } from './crypto/signer.js';
/**
 * The framework adapters as namespaces: `adapters.web`, `adapters.hono`,
 * `adapters.express`, `adapters.fastify`. Each is also its own entry point,
 * e.g. `@anzaui/engine/adapters/hono`.
 * @category Adapters
 */
export * as adapters from './adapters/index.js';

export { htmlResponse, jsonResponse, sseEvent } from './adapters/web.js';
