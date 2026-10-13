/**
 * SHA-256 digests (`node:crypto`), used for template digests and the {@link Manifest}.
 * @module
 */
import * as crypto from 'node:crypto';

/**
 * SHA-256 of `data` (strings are UTF-8 encoded).
 * @param data - The input.
 * @returns The 32-byte digest.
 */
export function hash(data: string | Uint8Array): Uint8Array {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  return new Uint8Array(crypto.createHash('sha256').update(buf).digest());
}

/**
 * Lowercase hex SHA-256 of `data` (strings are UTF-8 encoded).
 * @param data - The input.
 * @returns 64 lowercase hex characters.
 *
 * @example
 * ```ts
 * import { crypto } from '@anzaui/engine';
 * crypto.digest.hex('abc'); // 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
 * ```
 */
export function hex(data: string | Uint8Array): string {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  return crypto.createHash('sha256').update(buf).digest('hex');
}
