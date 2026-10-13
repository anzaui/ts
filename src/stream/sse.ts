import type { Envelope } from '../models/envelope.js';

/**
 * Encode an envelope as one Server-Sent Events message:
 * `event: template`, `data: <envelope JSON>`, then a blank line.
 *
 * {@link sseEvent} (web adapter) is the same function.
 *
 * @param envelope - The envelope to send.
 * @returns The SSE frame, `"event: template\ndata: {…}\n\n"`.
 *
 * @example
 * ```ts
 * import { Envelope, formatEvent } from '@anzaui/engine';
 *
 * formatEvent(new Envelope('feed', 1724771200, '<article>Live Post</article>'));
 * // 'event: template\ndata: {"v":2,"slot":"feed","ts":1724771200,"html":"<article>Live Post</article>"}\n\n'
 * ```
 *
 * @category Streaming
 */
export function formatEvent(envelope: Envelope): string {
  const json = JSON.stringify(envelope);
  return `event: template\ndata: ${json}\n\n`;
}
