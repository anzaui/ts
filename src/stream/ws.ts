import type { Envelope } from '../models/envelope.js';

/**
 * Encode an envelope as a WebSocket text message (the envelope JSON).
 *
 * @param envelope - The envelope to send.
 * @returns The compact envelope JSON, `'{"v":2,"slot":…}'`.
 *
 * @example
 * ```ts
 * import { Envelope, formatPacket } from '@anzaui/engine';
 *
 * const text = formatPacket(new Envelope('notifications', 1724771200, '<ui-toast>Order Shipped</ui-toast>'));
 * socket.send(text); // with your WebSocket library
 * ```
 *
 * @category Streaming
 */
export function formatPacket(envelope: Envelope): string {
  return JSON.stringify(envelope);
}
