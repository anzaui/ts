/**
 * HKDF-SHA256 key derivation (RFC 5869), e.g. a per-user HMAC secret from a
 * session token.
 *
 * @remarks
 * No signing mode uses it automatically: derive a key and pass it to
 * `crypto.hmac.sign`, {@link Setup}'s `secret` or {@link verifyEnvelope}
 * yourself. The same inputs always give the same key (the server can
 * re-derive it per request), and one derived key reveals neither the input key
 * nor other derived keys.
 *
 * @module
 */
import * as crypto from 'node:crypto';
import { AnzaError } from '../errors/index.js';

/**
 * Derive a key with HKDF-SHA256.
 *
 * @param ikm - Input key material (e.g. a session token).
 * @param salt - Optional salt. Default: empty.
 * @param info - Context string. Default `'anza-stui-session-v1'`.
 * @param keylen - Output length in bytes. Default 32; keep it at 32 or more,
 *   since HMAC signing and verification reject shorter secrets.
 * @returns The derived key.
 * @throws {@link AnzaError} `CRYPTO` (as a rejection) when derivation fails.
 *
 * @example
 * ```ts
 * import { crypto as anzaCrypto, verifyEnvelope } from '@anzaui/engine';
 *
 * const userKey = await anzaCrypto.hkdf.deriveKey(sessionToken, 'anza-cluster-salt-2026', 'user-live-feed', 32);
 * verifyEnvelope({ mode: 'hmac', secret: userKey }, envelope, { maxAgeSecs: 60, slot: 'feed' });
 * ```
 */
export function deriveKey(
  ikm: string | Uint8Array,
  salt?: string | Uint8Array,
  info: string | Uint8Array = 'anza-stui-session-v1',
  keylen = 32
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ikmBuf = typeof ikm === 'string' ? Buffer.from(ikm, 'utf8') : Buffer.from(ikm);
    const saltBuf = salt ? (typeof salt === 'string' ? Buffer.from(salt, 'utf8') : Buffer.from(salt)) : Buffer.alloc(0);
    const infoBuf = typeof info === 'string' ? Buffer.from(info, 'utf8') : Buffer.from(info);

    crypto.hkdf('sha256', ikmBuf, saltBuf, infoBuf, keylen, (err, derivedKey) => {
      if (err) {
        reject(AnzaError.crypto(`HKDF key derivation failed: ${err.message}`));
      } else {
        resolve(Buffer.from(derivedKey));
      }
    });
  });
}
