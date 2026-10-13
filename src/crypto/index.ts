/**
 * Signing and verification primitives: envelope signatures (v2), the
 * {@link Signer}, and low-level SHA-256, HMAC, Ed25519, HKDF and hex helpers.
 * The common entries ({@link verifyEnvelope}, {@link signatureMessage},
 * {@link Signer}) are also exported from the package root.
 *
 * @example
 * ```ts
 * import { crypto } from '@anzaui/engine';
 *
 * crypto.digest.hex('<p>hi</p>');
 * crypto.hmac.sign(secret, crypto.signatureMessage(ts, 'feed', html));
 * ```
 *
 * @module
 */

/** SHA-256 digests. */
export * as digest from './digest.js';
/** Ed25519 keys, signing and verification. */
export * as ed25519 from './ed25519.js';
/** Strict lowercase hex. */
export * as hex from './hex.js';
/** HKDF-SHA256 key derivation. */
export * as hkdf from './hkdf.js';
/** HMAC-SHA256 signing and verification. */
export * as hmac from './hmac.js';
export { Signer, HMAC_MIN_SECRET, redact, type SignOptions } from './signer.js';
export { verifyEnvelope, signatureMessage, signatureText, ENVELOPE_VERSION, SIGNATURE_DOMAIN, DEFAULT_SKEW_SECS, type VerifyKey, type VerifyOptions, type ReceivedEnvelope } from './envelope.js';
