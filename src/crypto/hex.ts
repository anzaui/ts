/**
 * Strict lowercase hex, the only encoding used for signatures and digests on
 * the wire. `decode` rejects uppercase digits, odd lengths and any other
 * character, so a signature has exactly one accepted spelling
 * (`Buffer.from(s, 'hex')` silently stops at the first bad character).
 *
 * @module
 */

const STRICT = /^(?:[0-9a-f]{2})*$/;

/**
 * Lowercase hex of `bytes`.
 * @param bytes - The input.
 * @returns Two lowercase hex characters per byte.
 */
export function encode(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('hex');
}

/**
 * Decode lowercase, even-length hex.
 * @param text - The hex string.
 * @returns The bytes, or `null` for uppercase, odd-length or non-hex input.
 *
 * @example
 * ```ts
 * crypto.hex.decode('0aff'); // <Buffer 0a ff>
 * crypto.hex.decode('0AFF'); // null
 * ```
 */
export function decode(text: string): Buffer | null {
  if (typeof text !== 'string' || !STRICT.test(text)) return null;
  return Buffer.from(text, 'hex');
}

/**
 * Decode exactly `length` bytes of lowercase hex.
 * @param text - The hex string.
 * @param length - Expected number of bytes.
 * @returns The bytes, or `null` for anything else.
 */
export function decodeLength(text: string, length: number): Buffer | null {
  if (typeof text !== 'string' || text.length !== length * 2) return null;
  return decode(text);
}
