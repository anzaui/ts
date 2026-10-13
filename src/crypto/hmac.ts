/**
 * Low-level HMAC-SHA256 helpers over `node:crypto`.
 *
 * @remarks
 * HMAC uses one shared secret for signing and verifying, so use it when every
 * verifier is trusted with the secret (internal services, your own edge).
 * Never ship the secret to browsers. `verify` alone accepts a replayed,
 * unchanged message: {@link verifyEnvelope} also rejects old timestamps and
 * envelopes replayed into another slot.
 *
 * @example
 * ```ts
 * import { crypto as anzaCrypto, signatureMessage } from '@anzaui/engine';
 *
 * const secret = process.env.ANZA_SECRET!;
 * const message = signatureMessage(1724771200, 'feed', '<ui-alert>OK</ui-alert>');
 * const sig = anzaCrypto.hmac.sign(secret, message);
 * anzaCrypto.hmac.verify(secret, message, sig); // true
 * anzaCrypto.hmac.verify(secret, signatureMessage(1724771200, 'feed', '<ui-alert>Corrupted</ui-alert>'), sig); // false
 * ```
 *
 * @module
 */
import * as crypto from 'node:crypto';
import { decodeLength } from './hex.js';

/**
 * HMAC-SHA256 of `data`.
 * @param secret - The key; strings are UTF-8 encoded. No minimum length is enforced here.
 * @param data - The message; strings are UTF-8 encoded.
 * @returns 64 lowercase hex characters.
 */
export function sign(secret: string | Uint8Array, data: string | Uint8Array): string {
  const secretBuf = typeof secret === 'string' ? Buffer.from(secret, 'utf8') : Buffer.from(secret);
  const dataBuf = typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data);
  return crypto.createHmac('sha256', secretBuf).update(dataBuf).digest('hex');
}

/**
 * Verify a lowercase-hex HMAC-SHA256 signature in constant time
 * (`crypto.timingSafeEqual`). Malformed signatures (wrong length, non-hex,
 * uppercase, trailing characters) return `false` instead of throwing.
 * @param secret - The key; strings are UTF-8 encoded.
 * @param data - The message; strings are UTF-8 encoded.
 * @param signatureHex - Exactly 64 lowercase hex characters.
 * @returns `true` when the signature is valid.
 */
export function verify(secret: string | Uint8Array, data: string | Uint8Array, signatureHex: string): boolean {
  const actual = decodeLength(signatureHex, 32);
  if (!actual) return false;
  try {
    const secretBuf = typeof secret === 'string' ? Buffer.from(secret, 'utf8') : Buffer.from(secret);
    const dataBuf = typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data);
    const expected = crypto.createHmac('sha256', secretBuf).update(dataBuf).digest();
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
