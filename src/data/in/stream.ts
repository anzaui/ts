import { AnzaError } from '../../errors/index.js';
import type { Engine } from '../../engine/cache/engine.js';
import type { Params } from '../../engine/slot/index.js';
import type { Envelope } from '../../models/envelope.js';

/**
 * A pushed fragment: identical to {@link Fragment}, named for SSE and
 * WebSocket use. Encode the result with {@link formatEvent} (SSE) or
 * {@link formatPacket} (WebSocket).
 *
 * @remarks
 * Server-Sent Events and WebSockets carry the same envelope JSON as a fragment
 * fetch. The engine provides the encoders; the transport and the loop that
 * pushes updates are your server's. The Anza browser library has no built-in
 * listener: use `EventSource` / `WebSocket` and apply `envelope.html` to the
 * target yourself.
 *
 * @example Node.js SSE endpoint
 * ```ts
 * import * as http from 'node:http';
 * import { Setup, Stream, formatEvent } from '@anzaui/engine';
 *
 * const engine = await new Setup({ root: './templates' }).run();
 *
 * http.createServer((req, res) => {
 *   if (req.url !== '/feed/stream') return void res.writeHead(404).end();
 *   res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
 *   const timer = setInterval(async () => {
 *     const envelope = await new Stream('feed/card.html', 'feed', { title: 'Live Event' }).run(engine);
 *     res.write(formatEvent(envelope));
 *   }, 2000);
 *   req.on('close', () => clearInterval(timer));
 * }).listen(3000);
 * ```
 *
 * @category Streaming
 */
export class Stream {
  /**
   * @param template - Template name relative to the root.
   * @param slot - The target name written into the envelope.
   * @param params - Values for the template placeholders.
   */
  constructor(
    /** Template name relative to the root. */
    public template: string,
    /** The target name written into the envelope. */
    public slot: string,
    /** Values for the template placeholders. */
    public params?: Params
  ) {}

  /**
   * Check the request.
   * @throws {@link AnzaError} `VALIDATION` when the template or slot is empty.
   */
  validate(): void {
    if (!this.template) {
      throw AnzaError.validation('Template cannot be empty');
    }
    if (!this.slot) {
      throw AnzaError.validation('Slot cannot be empty');
    }
  }

  /**
   * Validate and render the envelope.
   * @param engine - The engine from {@link Setup.run}.
   * @returns The (signed, when signing is on) envelope.
   * @throws {@link AnzaError} `VALIDATION` for an empty or malformed name or
   *   slot; `NOT_FOUND` for an unknown template or one outside the allowlist.
   */
  async run(engine: Engine): Promise<Envelope> {
    this.validate();
    return engine.renderFragment(this.template, this.slot, this.params);
  }
}
