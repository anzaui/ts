import { ENVELOPE_VERSION, signatureMessage } from '../crypto/envelope.js';

/**
 * The JSON shape of an envelope on the wire (format v2), as produced by
 * {@link Envelope.toJSON}: `{"v":2,"slot":…,"ts":…,"html":…,"sig"?:…,"css"?:…}`.
 *
 * @category Streaming
 */
export interface EnvelopeData {
  /** Wire-format version, always 2 for envelopes this engine produces. */
  v: number;
  /** The target name chosen when rendering; the client decides what it maps to. */
  slot: string;
  /** Unix time in seconds when the envelope was rendered. */
  ts: number;
  /** The bound fragment HTML (escaped only where `escape: true` applies). */
  html: string;
  /** Lowercase hex signature over the v2 message; present when signing is on. */
  sig?: string;
  /** Optional CSS text. The engine never sets it, but it is covered by the signature when present. */
  css?: string;
}

/**
 * A rendered fragment on the wire (format v2), returned by
 * {@link Fragment.run}, {@link Stream.run} and {@link Engine.renderFragment}.
 *
 * `JSON.stringify(envelope)` gives compact JSON with `v` first and `sig` /
 * `css` omitted when undefined. The same JSON goes over `fetch`, as an SSE
 * `data:` line ({@link formatEvent}) or as a WebSocket text frame
 * ({@link formatPacket}).
 *
 * @remarks
 * When signing is on, {@link Envelope.sig | sig} is the lowercase hex
 * HMAC-SHA256 or Ed25519 signature of {@link Envelope.message | message()}:
 * the length-prefixed v2 message over `ts`, `slot`, `html` and `css` (see
 * {@link signatureMessage}). Changing any of them breaks the signature.
 *
 * The Anza browser library does not apply or verify envelopes: your code puts
 * `html` into the target, and a server or edge that relays envelopes checks
 * them with {@link verifyEnvelope}. `html` is only escaped where the engine
 * runs with `escape: true`.
 *
 * See the [Engine Contract](https://github.com/anzaui/anza/blob/main/docs/engines/contract.md)
 * for the format shared by all engines.
 *
 * @example
 * ```ts
 * const envelope = await new Fragment('feed/card.html', 'feed', { title: 'New post' }).run(engine);
 * JSON.stringify(envelope);
 * // {"v":2,"slot":"feed","ts":1724771234,"html":"<ui-card>New post</ui-card>","sig":"…"}
 * ```
 *
 * @category Streaming
 */
export class Envelope implements EnvelopeData {
  /** Wire-format version, always {@link ENVELOPE_VERSION} (2). */
  readonly v = ENVELOPE_VERSION;

  /**
   * @param slot - Target name.
   * @param ts - Unix time in seconds.
   * @param html - Fragment HTML.
   * @param sig - Lowercase hex signature of the v2 message, if signed.
   * @param css - Optional CSS text.
   */
  constructor(
    /** The target name chosen when rendering. */
    public slot: string,
    /** Unix time in seconds when the envelope was rendered. */
    public ts: number,
    /** The bound fragment HTML. */
    public html: string,
    /** Lowercase hex signature over {@link Envelope.message | message()}, present for `hmac` and `ed25519` signing. */
    public sig?: string,
    /** Optional CSS text; the engine never sets it. */
    public css?: string
  ) {}

  /** The exact bytes the signature covers (v2, length-prefixed fields), see {@link signatureMessage}. */
  message(): Buffer {
    return signatureMessage(this.ts, this.slot, this.html, this.css);
  }

  /** The wire JSON: `v` first, `sig` and `css` omitted when undefined. */
  toJSON(): EnvelopeData {
    const data: EnvelopeData = {
      v: this.v,
      slot: this.slot,
      ts: this.ts,
      html: this.html,
    };
    if (this.sig !== undefined) data.sig = this.sig;
    if (this.css !== undefined) data.css = this.css;
    return data;
  }
}
