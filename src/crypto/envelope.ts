import { AnzaError } from '../errors/index.js';
import type { EnvelopeData } from '../models/envelope.js';
import { decode } from './hex.js';
import * as hmac from './hmac.js';
import * as ed25519 from './ed25519.js';
import { HMAC_MIN_SECRET } from './signer.js';

/**
 * Envelope wire-format version produced and accepted by this engine (2).
 * @category Signing
 */
export const ENVELOPE_VERSION = 2;

/**
 * Domain-separation prefix of every v2 signature message: `"anza-sig-v2\n"`.
 * @category Signing
 */
export const SIGNATURE_DOMAIN = 'anza-sig-v2\n';

/**
 * Default tolerance, in seconds, for an envelope timestamp ahead of the
 * verifier's clock (5).
 * @category Signing
 */
export const DEFAULT_SKEW_SECS = 5;

const field = (value: string): string => `${Buffer.byteLength(value, 'utf8')}:${value}\n`;

/**
 * The v2 message as a string; its UTF-8 encoding is the signed bytes. Hashing
 * this directly avoids building intermediate buffers. See
 * {@link signatureMessage} for the format.
 *
 * @param ts - Unix time in seconds.
 * @param slot - Target name.
 * @param html - Fragment HTML.
 * @param css - Optional CSS; absent is the empty string.
 * @returns The message text.
 *
 * @category Signing
 */
export function signatureText(ts: number, slot: string, html: string, css?: string | null): string {
  return SIGNATURE_DOMAIN + field(String(ts)) + field(slot) + field(html) + field(css ?? '');
}

/**
 * The exact bytes a v2 envelope signature covers.
 *
 * @remarks
 * Signature v2, shared by all engines (see the
 * [Engine Contract](https://github.com/anzaui/anza/blob/main/docs/engines/contract.md)):
 *
 * ```text
 * message  = "anza-sig-v2\n" field(ts) field(slot) field(html) field(css)
 * field(x) = <decimal UTF-8 byte length of x> ":" x "\n"
 * ```
 *
 * `ts` is written in decimal and an absent `css` is the empty string. Every
 * field is length-prefixed, so two different envelopes never share a message,
 * and changing the timestamp, slot, HTML or CSS breaks the signature. The
 * signature (`sig`) is the lowercase hex HMAC-SHA256 or Ed25519 signature of
 * these bytes.
 *
 * To verify in the browser yourself (the Anza browser library does not),
 * rebuild the same bytes and call `crypto.subtle.verify`.
 *
 * @param ts - Unix time in seconds.
 * @param slot - Target name.
 * @param html - Fragment HTML.
 * @param css - Optional CSS; absent is the empty string.
 * @returns The UTF-8 message bytes.
 *
 * @example
 * ```ts
 * import { signatureMessage } from '@anzaui/engine';
 *
 * signatureMessage(1, 'a:b', 'c').toString();
 * // 'anza-sig-v2\n1:1\n3:a:b\n1:c\n0:\n'
 * ```
 *
 * @example Verifying with Web Crypto in your own browser code
 * ```js
 * const enc = new TextEncoder();
 * const field = (x) => `${enc.encode(x).length}:${x}\n`;
 * const message = (env) =>
 *   enc.encode('anza-sig-v2\n' + field(String(env.ts)) + field(env.slot) + field(env.html) + field(env.css ?? ''));
 *
 * async function verify(env, publicKeyBytes, slot, maxAgeSecs = 60) {
 *   if (env.v !== 2 || env.slot !== slot || !/^[0-9a-f]{128}$/.test(env.sig ?? '')) return false;
 *   const now = Math.floor(Date.now() / 1000);
 *   if (env.ts > now + 5 || now - env.ts > maxAgeSecs) return false;
 *   const key = await crypto.subtle.importKey('raw', publicKeyBytes, { name: 'Ed25519' }, false, ['verify']);
 *   const sig = Uint8Array.from(env.sig.match(/../g), (h) => parseInt(h, 16));
 *   return crypto.subtle.verify({ name: 'Ed25519' }, key, sig, message(env));
 * }
 * ```
 *
 * @category Signing
 */
export function signatureMessage(ts: number, slot: string, html: string, css?: string | null): Buffer {
  return Buffer.from(signatureText(ts, slot, html, css), 'utf8');
}

/**
 * The key that checks an envelope signature: the shared HMAC secret (at least
 * 32 bytes) or the Ed25519 public key (32 bytes, 64-char lowercase hex, PEM or
 * `KeyObject`).
 * @category Signing
 */
export type VerifyKey =
  | {
      /** Shared-secret HMAC-SHA256. */
      mode: 'hmac';
      /** The HMAC secret, at least 32 bytes (a string counts its UTF-8 bytes). */
      secret: string | Uint8Array;
    }
  | {
      /** Ed25519 public-key signatures. */
      mode: 'ed25519';
      /** The Ed25519 public key: 32 bytes, 64-char lowercase hex, PEM or `KeyObject`. */
      publicKey: ed25519.Ed25519Key;
    };

/**
 * Freshness window and expected slot for {@link verifyEnvelope}.
 * @category Signing
 */
export interface VerifyOptions {
  /** Reject envelopes older than this many seconds. */
  maxAgeSecs: number;
  /** The slot the envelope must target (stops replay into another slot). */
  slot: string;
  /** Accept timestamps this many seconds in the future (clock skew). Default 5. */
  skewSecs?: number;
  /** The verifier's clock, in Unix seconds. Default: `Date.now()`. */
  now?: number;
}

/**
 * Envelope as received: a parsed JSON object or an {@link Envelope}. Every
 * field is checked by {@link verifyEnvelope}, so it may come straight from
 * `JSON.parse`.
 * @category Signing
 */
export type ReceivedEnvelope = Partial<EnvelopeData> & {
  /** Must be 2. */
  v?: unknown;
  /** Must be a non-negative safe integer (Unix seconds). */
  ts?: unknown;
};

/** @internal Every check except the signature, then `checkSig`. Throws `CRYPTO`. */
export function verifyWith(
  envelope: ReceivedEnvelope,
  options: VerifyOptions,
  checkSig: (message: string, sig: string) => boolean
): void {
  if (!envelope || envelope.v !== ENVELOPE_VERSION) throw AnzaError.crypto('unsupported envelope version');
  const { ts, slot, html, css, sig } = envelope;
  if (typeof ts !== 'number' || !Number.isSafeInteger(ts) || ts < 0 || typeof slot !== 'string' || typeof html !== 'string' || (css != null && typeof css !== 'string')) {
    throw AnzaError.crypto('malformed envelope');
  }
  if (sig === undefined || sig === null) throw AnzaError.crypto('envelope is not signed');
  if (typeof sig !== 'string' || decode(sig) === null) throw AnzaError.crypto('malformed signature');
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const skew = options.skewSecs ?? DEFAULT_SKEW_SECS;
  if (ts > now + skew) throw AnzaError.crypto('envelope timestamp is in the future');
  if (now - ts > options.maxAgeSecs) throw AnzaError.crypto('envelope expired');
  if (slot !== options.slot) throw AnzaError.crypto('slot mismatch');
  if (!checkSig(signatureText(ts, slot, html, css), sig)) throw AnzaError.crypto('bad signature');
}

/**
 * Verify a received envelope: version, signature format, freshness
 * (`maxAgeSecs`, plus `skewSecs` into the future), the expected slot, then
 * the signature (constant-time). Returns normally when the envelope is valid.
 *
 * @remarks
 * TLS protects each hop, but a CDN or proxy that terminates TLS can still
 * change a response. Signed envelopes let whoever receives a fragment (a
 * server or edge that relays it, another service) check that it came from the
 * origin unchanged. The Anza browser library does **not** verify envelopes.
 *
 * The checks run in this order; the first failure throws `CRYPTO` with:
 *
 * | Check | Message |
 * |---|---|
 * | `v` is `2` | `unsupported envelope version` |
 * | `ts`, `slot`, `html`, `css` have the right types | `malformed envelope` |
 * | `sig` is present | `envelope is not signed` |
 * | `sig` is strict lowercase hex | `malformed signature` |
 * | `ts <= now + skewSecs` | `envelope timestamp is in the future` |
 * | `now - ts <= maxAgeSecs` | `envelope expired` |
 * | `slot` equals `options.slot` | `slot mismatch` |
 * | the signature verifies (constant-time) | `bad signature` |
 *
 * An HMAC secret shorter than 32 bytes, a malformed Ed25519 public key or an
 * unknown mode is `invalid verification key`. The slot check stops a fragment
 * signed for one slot from being replayed into another; `maxAgeSecs` limits
 * replay in time. {@link Engine.verifyEnvelope} runs the same checks with the
 * engine's own key.
 *
 * @param key - `{ mode: 'hmac', secret }` or `{ mode: 'ed25519', publicKey }`.
 * @param envelope - The received envelope (parsed JSON or an {@link Envelope}).
 * @param options - `{ maxAgeSecs, slot, skewSecs?, now? }`.
 * @throws {@link AnzaError} `CRYPTO` whose message names the failed check.
 *
 * @example
 * ```ts
 * import { AnzaError, verifyEnvelope } from '@anzaui/engine';
 *
 * try {
 *   verifyEnvelope({ mode: 'ed25519', publicKey: publicHex }, JSON.parse(body), { maxAgeSecs: 60, slot: 'feed' });
 * } catch (err) {
 *   if (err instanceof AnzaError && err.code === 'CRYPTO') return reject(err.message); // e.g. "envelope expired"
 *   throw err;
 * }
 * ```
 *
 * @category Signing
 */
export function verifyEnvelope(key: VerifyKey, envelope: ReceivedEnvelope, options: VerifyOptions): void {
  if (key.mode === 'hmac') {
    const secret = typeof key.secret === 'string' ? Buffer.from(key.secret, 'utf8') : key.secret;
    if (!secret || secret.length < HMAC_MIN_SECRET) throw AnzaError.crypto('invalid verification key');
    return verifyWith(envelope, options, (msg, sig) => hmac.verify(secret, msg, sig));
  }
  if (key.mode === 'ed25519') {
    let pub;
    try {
      pub = ed25519.publicKey(key.publicKey);
    } catch {
      throw AnzaError.crypto('invalid verification key');
    }
    return verifyWith(envelope, options, (msg, sig) => ed25519.verify(pub, msg, sig));
  }
  throw AnzaError.crypto('invalid verification key');
}
