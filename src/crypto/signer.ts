import * as crypto from 'node:crypto';
import { AnzaError } from '../errors/index.js';
import { privateKey, publicKey, rawPublicKey, type Ed25519Key } from './ed25519.js';
import { decodeLength } from './hex.js';

/**
 * Minimum HMAC-SHA256 secret length, in bytes (32).
 * @category Signing
 */
export const HMAC_MIN_SECRET = 32;

/**
 * How envelopes are signed, passed to {@link SetupOptions.signing}.
 *
 * | Mode | `sig` | Verify with |
 * |---|---|---|
 * | `ed25519` | lowercase hex Ed25519 signature, using `privateKey` | `verifyEnvelope({ mode: 'ed25519', publicKey }, …)` |
 * | `hmac` | lowercase hex HMAC-SHA256, using `secret` | `verifyEnvelope({ mode: 'hmac', secret }, …)` |
 * | `none` | none (the default) | — |
 *
 * @remarks
 * Keys are checked once, in {@link Setup.run} (or {@link Signer.from}), which
 * throws `CRYPTO` for a missing or short HMAC secret, a missing or malformed
 * Ed25519 private key, or a public key that does not match. The engine never
 * falls back to unsigned envelopes. Prefer Ed25519 when verifiers should not
 * be able to sign; HMAC when every verifier is trusted with the secret.
 *
 * @example
 * ```ts
 * const hmac: SignOptions = { mode: 'hmac', secret: process.env.ANZA_SECRET! };
 * const ed: SignOptions = { mode: 'ed25519', privateKey: process.env.ANZA_ED25519_SEED! }; // 64-char hex
 * ```
 *
 * @category Signing
 */
export interface SignOptions {
  /** The signing algorithm, or `'none'` for unsigned envelopes. */
  mode: 'ed25519' | 'hmac' | 'none';
  /** HMAC secret, at least 32 bytes (a string counts its UTF-8 bytes). */
  secret?: string | Uint8Array;
  /** Ed25519 private key: 32-byte seed, 64-char hex seed, PEM, or `KeyObject`. */
  privateKey?: Ed25519Key;
  /** Optional Ed25519 public key; must match `privateKey` when given. */
  publicKey?: Ed25519Key;
}

const INSPECT = Symbol.for('nodejs.util.inspect.custom');

/**
 * A validated signing key, built once at setup and available as
 * {@link Engine.signer}. A running engine never signs with a missing, short or
 * mismatched key, and `inspect` / `JSON.stringify` never print key material.
 *
 * @example
 * ```ts
 * import { Signer, signatureText } from '@anzaui/engine';
 *
 * const signer = Signer.from({ mode: 'hmac', secret: process.env.ANZA_SECRET! });
 * const sig = signer.sign(signatureText(1724771200, 'feed', '<p>hi</p>'));
 * signer.verify(signatureText(1724771200, 'feed', '<p>hi</p>'), sig!); // true
 * ```
 *
 * @category Signing
 */
export class Signer {
  /** The signing mode. */
  readonly mode: SignOptions['mode'];
  #hmac?: Buffer;
  #ed25519?: crypto.KeyObject;
  #public?: Buffer;

  private constructor(mode: SignOptions['mode']) {
    this.mode = mode;
  }

  /**
   * Validate `options` and decode its keys.
   * @param options - The signing options. Default `{ mode: 'none' }`.
   * @returns The signer.
   * @throws {@link AnzaError} `CRYPTO` for a short or missing HMAC secret, a
   *   missing or malformed Ed25519 key, a mismatched public key, or an unknown mode.
   */
  static from(options: SignOptions = { mode: 'none' }): Signer {
    const signer = new Signer(options.mode);
    switch (options.mode) {
      case 'none':
        return signer;
      case 'hmac': {
        const secret = options.secret;
        const bytes = typeof secret === 'string' ? Buffer.from(secret, 'utf8') : secret ? Buffer.from(secret) : Buffer.alloc(0);
        if (bytes.length < HMAC_MIN_SECRET) {
          throw AnzaError.crypto(`HMAC secret must be at least ${HMAC_MIN_SECRET} bytes`);
        }
        signer.#hmac = bytes;
        return signer;
      }
      case 'ed25519': {
        if (!options.privateKey) throw AnzaError.crypto('Ed25519 signing needs a private key');
        const key = privateKey(options.privateKey);
        const pub = rawPublicKey(key);
        if (options.publicKey !== undefined) {
          const given = rawPublicKey(publicKey(options.publicKey));
          if (!crypto.timingSafeEqual(given, pub)) {
            throw AnzaError.crypto('Ed25519 public key does not match the private key');
          }
        }
        signer.#ed25519 = key;
        signer.#public = pub;
        return signer;
      }
      default:
        throw AnzaError.crypto(`Unknown signing mode '${String((options as SignOptions).mode)}'`);
    }
  }

  /**
   * Sign `message`.
   * @param message - The bytes to sign (strings are UTF-8 encoded).
   * @returns Lowercase hex signature, or `undefined` when signing is off.
   */
  sign(message: string | Uint8Array): string | undefined {
    if (this.#hmac) return crypto.createHmac('sha256', this.#hmac).update(message).digest('hex');
    if (this.#ed25519) return crypto.sign(null, typeof message === 'string' ? Buffer.from(message, 'utf8') : message, this.#ed25519).toString('hex');
    return undefined;
  }

  /**
   * Check a lowercase-hex signature made by this signer (constant-time).
   * @param message - The signed bytes (strings are UTF-8 encoded).
   * @param signatureHex - The signature as lowercase hex.
   * @returns `true` when valid; always `false` when signing is off or the hex is malformed.
   */
  verify(message: string | Uint8Array, signatureHex: string): boolean {
    if (this.#hmac) {
      const actual = decodeLength(signatureHex, 32);
      if (!actual) return false;
      return crypto.timingSafeEqual(crypto.createHmac('sha256', this.#hmac).update(message).digest(), actual);
    }
    if (this.#ed25519) {
      const actual = decodeLength(signatureHex, 64);
      if (!actual) return false;
      const data = typeof message === 'string' ? Buffer.from(message, 'utf8') : message;
      return crypto.verify(null, data, crypto.createPublicKey(this.#ed25519), actual);
    }
    return false;
  }

  /** The raw 32-byte Ed25519 public key that verifies this signer's signatures. */
  get publicKey(): Buffer | undefined {
    return this.#public ? Buffer.from(this.#public) : undefined;
  }

  /** Only the mode, never the key. */
  toJSON(): {
    /** The signing mode. */
    mode: string;
  } {
    return { mode: this.mode };
  }

  /**
   * Node's `util.inspect` hook: prints the mode and `<redacted>`.
   * @hidden
   */
  [INSPECT](): string {
    return this.mode === 'none' ? 'Signer { mode: none }' : `Signer { mode: ${this.mode}, key: <redacted> }`;
  }
}

/**
 * A copy of `options` safe to log: key material replaced by `<redacted>`.
 * @param options - The signing options.
 * @returns `{ mode, secret?: '<redacted>', privateKey?: '<redacted>', publicKey?: '<set>' }`.
 * @category Signing
 */
export function redact(options: SignOptions): Record<string, string> {
  const out: Record<string, string> = { mode: options.mode };
  if (options.secret !== undefined) out.secret = '<redacted>';
  if (options.privateKey !== undefined) out.privateKey = '<redacted>';
  if (options.publicKey !== undefined) out.publicKey = '<set>';
  return out;
}
