import { Signer, type SignOptions } from '../../crypto/signer.js';
import { signatureText, verifyWith, type ReceivedEnvelope, type VerifyOptions } from '../../crypto/envelope.js';
import { AnzaError } from '../../errors/index.js';
import { Document, Envelope, Manifest } from '../../models/index.js';
import type { Params } from '../slot/index.js';
import type { Template } from '../file/load.js';
import type { FileWatcher } from '../file/watch.js';
import { CacheStore } from './store.js';
import { fragmentAllowed } from '../name.js';
import { renderPageDocument } from '../../render/page.js';

export type { SignOptions };

/**
 * Options for the {@link Engine} constructor (normally set through
 * {@link SetupOptions}).
 *
 * @category Engine
 */
export interface EngineOptions {
  /**
   * Fragment allowlist. Empty (the default) lets `renderFragment` use any
   * template; otherwise an entry ending in `/` allows that prefix (e.g.
   * `'fragments/'`) and any other entry allows that exact name. See
   * {@link fragmentAllowed}.
   */
  fragments?: string[];
}

/**
 * A loaded template set plus a validated signing key. Get one from
 * {@link Setup.run}; it renders pages ({@link Engine.renderPage}) and
 * envelopes ({@link Engine.renderFragment}).
 *
 * @remarks
 * The engine has three steps: **load** (read and SHA-256 each `.html` file),
 * **parse** (split into chunks and build a render function), both done once by
 * {@link Setup.run}, and **render** (call the function, then optionally
 * sign). Rendering does a name check and one `Map.get`, then a loop of string
 * concatenations; it never reads the filesystem.
 *
 * The cache store and file watcher types are internal: build engines with
 * {@link Setup} rather than this constructor.
 *
 * @example
 * ```ts
 * const engine = await new Setup({ root: './templates' }).run();
 * const doc = await engine.renderPage('/', { title: 'Home' });
 * const envelope = await engine.renderFragment('feed/card.html', 'feed', { title: 'Live' });
 * ```
 *
 * @category Engine
 */
export class Engine {
  /**
   * The validated signing key. Never printed; `signer.publicKey` is the raw
   * Ed25519 public key to publish to verifiers.
   */
  readonly signer: Signer;
  /** Fragment allowlist (see {@link EngineOptions.fragments}). */
  readonly fragments: readonly string[];

  /**
   * @param root - The template root directory.
   * @param cache - The loaded templates.
   * @param signing - Signing options (validated here) or an existing {@link Signer}.
   * @param watcher - The file watcher when templates are reloaded on change.
   * @param options - Fragment allowlist.
   * @throws {@link AnzaError} `CRYPTO` when `signing` holds a missing or malformed key.
   */
  constructor(
    /** The template root directory. */
    public root: string,
    /** The in-memory template cache (replaced wholesale on reload). */
    public cache: CacheStore,
    signing: SignOptions | Signer = { mode: 'none' },
    /** The file watcher when `watch: true`; call `watcher.close()` to stop reloading. */
    public watcher?: FileWatcher,
    options: EngineOptions = {}
  ) {
    this.signer = signing instanceof Signer ? signing : Signer.from(signing);
    this.fragments = Object.freeze([...(options.fragments ?? [])]);
  }

  /**
   * Look a template up by name. Never touches the filesystem.
   *
   * @param name - Template name relative to the root, e.g. `feed/card.html`.
   * @returns The parsed template.
   * @throws {@link AnzaError} `VALIDATION` for a malformed name (see
   *   {@link validName}); `NOT_FOUND` when no such template is loaded.
   *
   * @example
   * ```ts
   * const html = engine.get('feed/card.html').bind({ title: 'Live Update' });
   * ```
   */
  get(name: string): Template {
    return this.cache.get(name);
  }

  /** Every loaded template with its lowercase hex SHA-256 digest. */
  manifest(): Manifest {
    const manifest = new Manifest();
    for (const [name, tpl] of this.cache.templates.entries()) {
      manifest.insert(name, tpl.digest);
    }
    return manifest;
  }

  /**
   * Sign a v2 message for `ts`, `slot` and `html` (no CSS) with the engine's key.
   *
   * @param ts - Unix time in seconds.
   * @param slot - Target name.
   * @param html - Fragment HTML.
   * @returns Lowercase hex signature, or `undefined` when signing is off.
   */
  async signPayload(ts: number, slot: string, html: string): Promise<string | undefined> {
    return this.signer.sign(signatureText(ts, slot, html));
  }

  /**
   * Verify an envelope against this engine's own key (HMAC secret or the
   * Ed25519 public key). Same checks, in the same order, as the standalone
   * {@link verifyEnvelope}.
   *
   * @param envelope - The received envelope (parsed JSON or an {@link Envelope}).
   * @param options - Freshness window and expected slot.
   * @throws {@link AnzaError} `CRYPTO` naming the failed check, or
   *   `signing is off` when the engine has no key.
   *
   * @example
   * ```ts
   * engine.verifyEnvelope(JSON.parse(body), { maxAgeSecs: 60, slot: 'feed' });
   * ```
   */
  verifyEnvelope(envelope: ReceivedEnvelope, options: VerifyOptions): void {
    if (this.signer.mode === 'none') throw AnzaError.crypto('signing is off');
    verifyWith(envelope, options, (msg, sig) => this.signer.verify(msg, sig));
  }

  /**
   * Render `templateName` into a (signed) envelope for `slot`. Templates
   * outside the `fragments` allowlist are reported as not found.
   *
   * @param templateName - Template name relative to the root.
   * @param slot - Target name written into the envelope.
   * @param params - Values for the placeholders.
   * @returns An envelope stamped with the current Unix time, signed when signing is on.
   * @throws {@link AnzaError} `VALIDATION` for a malformed name; `NOT_FOUND`
   *   for an unknown template or one outside the allowlist.
   */
  async renderFragment(templateName: string, slot: string, params?: Params): Promise<Envelope> {
    const tpl = this.get(templateName);
    if (!fragmentAllowed(this.fragments, templateName)) throw AnzaError.notFound(`Template '${templateName}' not found`);
    const html = tpl.bind(params);
    const ts = Math.floor(Date.now() / 1000);
    const sig = this.signer.mode === 'none' ? undefined : this.signer.sign(signatureText(ts, slot, html));

    return new Envelope(slot, ts, html, sig);
  }

  /**
   * Render the page for `route` (the pipeline is described on {@link Page}).
   *
   * @param route - The request path, e.g. `/` or `/docs/intro`.
   * @param params - Values for the page and shell placeholders.
   * @returns The full HTML document.
   * @throws {@link AnzaError} `NOT_FOUND` for an unknown or malformed route
   *   without a `pages/index.html` catch-all.
   */
  async renderPage(route: string, params?: Params): Promise<Document> {
    return renderPageDocument(this, route, params);
  }
}
