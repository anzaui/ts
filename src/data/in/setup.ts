import * as fs from 'node:fs';
import { AnzaError } from '../../errors/index.js';
import { all, DEFAULT_MAX_TEMPLATE_BYTES, type LoadOptions } from '../../engine/file/load.js';
import { listen, type FileWatcher } from '../../engine/file/watch.js';
import { CacheStore } from '../../engine/cache/store.js';
import { Engine } from '../../engine/cache/engine.js';
import { Signer, redact, type SignOptions } from '../../crypto/signer.js';

/**
 * Options for {@link Setup}.
 *
 * @category Engine
 */
export interface SetupOptions {
  /**
   * The template root. Every `.html` file under it is loaded, named by its
   * `/`-separated path relative to the root (e.g. `feed/card.html`).
   */
  root: string;
  /**
   * How envelopes are signed. Default `{ mode: 'none' }` (unsigned). The keys
   * are checked in {@link Setup.run}, see {@link SignOptions}.
   */
  signing?: SignOptions;
  /**
   * Reload all templates when a file under `root` changes. Default `false`.
   *
   * @remarks
   * Uses `fs.watch(root, { recursive: true })` (Node.js 20+ on Linux). A
   * burst of events triggers one reload 50 ms after the last event, reloads
   * never overlap, and a reload that fails (a half-written or oversized file)
   * keeps the last good templates. Meant for development.
   */
  watch?: boolean;
  /** Fragment allowlist, see {@link EngineOptions.fragments}. Default: every template. */
  fragments?: string[];
  /**
   * HTML-escape `{{name}}` values; `{{{name}}}` stays raw. Default `false`:
   * values are inserted as-is, so escape untrusted input with
   * {@link escapeHtml} yourself.
   *
   * @remarks
   * With `escape: true`, write `{{{content}}}` in `layout/shell.html`,
   * otherwise the page HTML is escaped a second time.
   */
  escape?: boolean;
  /**
   * Refuse template files larger than this many bytes with a `TEMPLATE`
   * error. Default {@link DEFAULT_MAX_TEMPLATE_BYTES} (1 MiB).
   */
  maxTemplateBytes?: number;
}

/**
 * Configures and starts an {@link Engine}: {@link Setup.run} checks the
 * template root and the signing keys, then loads and parses every template
 * once.
 *
 * @remarks
 * **Template layout.** Templates are plain `.html` files under `root`,
 * addressed by their relative path:
 *
 * | Path | Used by |
 * |---|---|
 * | `layout/shell.html` | Optional document shell for every page; the page goes into `{{content}}`. |
 * | `pages/home.html` | Route `/`. |
 * | `pages/<route>.html` | Route `/<route>` (fallback `pages/index.html`, else `NOT_FOUND`). |
 * | anything else | Fragments, addressed by name, e.g. `feed/card.html` (limited by `fragments` when set). |
 *
 * **Parse once.** `run()` reads every `.html` file, splits it into static
 * strings and `{{name}}` / `{{{name}}}` placeholders ({@link extract}) and
 * builds one render function per template ({@link compile}). There is no
 * parsing or regular expression work at request time, and request input
 * never reaches the filesystem: lookups only use the in-memory cache.
 * Symlinked directories are not followed, symlinked files that resolve
 * outside the root are skipped, and errors name the template, never the
 * absolute path.
 *
 * **Keys.** Signing keys are validated here, once. Each of these makes `run()`
 * reject with a `CRYPTO` error, so a running engine never sends unsigned
 * envelopes by accident: an HMAC `secret` that is missing or shorter than 32
 * bytes; an Ed25519 `privateKey` that is missing or not a 32-byte seed, a
 * 64-char lowercase hex seed, a PEM string or a `KeyObject`; a `publicKey`
 * that does not match the private key. `Setup`, {@link Engine} and
 * {@link Signer} never print key material: `inspect` and `JSON.stringify`
 * show `<redacted>`.
 *
 * **Runtimes.** The engine uses Node.js built-ins (`node:fs`, `node:crypto`)
 * and has no runtime dependencies. It runs on Node.js 18+ (tested), and on Bun
 * and Deno through their Node compatibility. Runtimes without a filesystem
 * (Cloudflare Workers and similar edge isolates) are not supported; there,
 * only the template core ({@link extract}, {@link compile},
 * {@link escapeHtml}, {@link stringify}) works.
 *
 * @example HMAC-signed engine
 * ```ts
 * import { Setup } from '@anzaui/engine';
 *
 * const engine = await new Setup({
 *   root: './templates',
 *   signing: { mode: 'hmac', secret: process.env.ANZA_SECRET! }, // at least 32 bytes
 *   fragments: ['feed/', 'widgets/clock.html'],
 *   escape: true,
 * }).run();
 * ```
 *
 * @example Ed25519 with a generated key pair
 * ```ts
 * import { generateKeyPairSync } from 'node:crypto';
 * import { Setup } from '@anzaui/engine';
 *
 * const { privateKey } = generateKeyPairSync('ed25519');
 * const engine = await new Setup({ root: './templates', signing: { mode: 'ed25519', privateKey } }).run();
 * const publicHex = engine.signer.publicKey!.toString('hex'); // publish this to verifiers
 * ```
 *
 * @category Engine
 */
export class Setup {
  /** The template root directory. */
  public root: string;
  /** The signing options (never printed: see {@link Setup.toJSON}). */
  public signing: SignOptions;
  /** Whether templates are reloaded on change. */
  public watch: boolean;
  /** The fragment allowlist (empty allows every template). */
  public fragments: string[];
  /** Whether `{{name}}` values are HTML-escaped. */
  public escape: boolean;
  /** Maximum template file size in bytes. */
  public maxTemplateBytes: number;

  /**
   * @param options - The options, or just the template root (unsigned, no escaping).
   */
  constructor(options: SetupOptions | string) {
    const o: SetupOptions = typeof options === 'string' ? { root: options } : options;
    this.root = o.root;
    this.signing = o.signing || { mode: 'none' };
    this.watch = Boolean(o.watch);
    this.fragments = [...(o.fragments ?? [])];
    this.escape = Boolean(o.escape);
    this.maxTemplateBytes = o.maxTemplateBytes ?? DEFAULT_MAX_TEMPLATE_BYTES;
  }

  /** The options with key material replaced by `<redacted>` (see {@link redact}), safe to log. */
  toJSON(): Record<string, unknown> {
    return {
      root: this.root,
      signing: redact(this.signing),
      watch: this.watch,
      fragments: this.fragments,
      escape: this.escape,
      maxTemplateBytes: this.maxTemplateBytes,
    };
  }

  /**
   * Node's `util.inspect` hook: prints {@link Setup.toJSON}, never keys.
   * @hidden
   */
  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return `Setup ${JSON.stringify(this.toJSON())}`;
  }

  /**
   * Check that the template root exists.
   * @throws {@link AnzaError} `VALIDATION` when `root` is empty or does not exist.
   */
  validate(): void {
    if (!this.root || !fs.existsSync(this.root)) {
      throw AnzaError.validation(`Template root directory does not exist: ${this.root}`);
    }
  }

  /**
   * Validate the root and the signing keys, load and parse every template,
   * and start the watcher when `watch` is set.
   *
   * @returns The ready engine.
   * @throws {@link AnzaError} `VALIDATION` when the root does not exist;
   *   `CRYPTO` for a missing, short or malformed signing key;
   *   `TEMPLATE` for a template that does not parse or is larger than
   *   `maxTemplateBytes`; `NOT_FOUND` for a template that cannot be read.
   *
   * @example
   * ```ts
   * const engine = await new Setup('./templates').run();
   * ```
   */
  async run(): Promise<Engine> {
    this.validate();
    const signer = Signer.from(this.signing);
    const load: LoadOptions = { escape: this.escape, maxBytes: this.maxTemplateBytes };
    const cache = new CacheStore(await all(this.root, load));

    let watcher: FileWatcher | undefined;
    if (this.watch) {
      // Debounced and serialized by the watcher: the newest tree always wins.
      watcher = listen(this.root, async () => {
        try {
          cache.templates = await all(this.root, load);
        } catch {
          // A half-written or oversized file: keep the last good tree; the
          // next event reloads it.
        }
      });
    }

    return new Engine(this.root, cache, signer, watcher, { fragments: this.fragments });
  }
}
