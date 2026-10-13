import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { digest } from '../../crypto/index.js';
import { AnzaError } from '../../errors/index.js';
import { extract, compile, type Chunk, type Params, type CompiledRenderer } from '../slot/index.js';

/**
 * Default cap on a template file's size: 1 MiB.
 * @category Engine
 */
export const DEFAULT_MAX_TEMPLATE_BYTES = 1024 * 1024;

/**
 * How templates are loaded (set from {@link SetupOptions}).
 * @category Engine
 */
export interface LoadOptions {
  /** HTML-escape `{{slot}}` values; `{{{raw}}}` stays raw. */
  escape?: boolean;
  /** Refuse template files larger than this many bytes. Default 1 MiB. */
  maxBytes?: number;
}

/**
 * One parsed template: its source, digest, chunks and compiled render
 * function. Get one with {@link Engine.get} or {@link one}.
 *
 * @example
 * ```ts
 * const tpl = engine.get('feed/card.html');
 * tpl.digest;                          // hex SHA-256 of the file
 * tpl.bind({ title: 'Live Update' });  // '<ui-card>Live Update</ui-card>'
 * ```
 *
 * @category Engine
 */
export class Template {
  /** The compiled render function (see {@link compile}). */
  public renderer: CompiledRenderer;

  /**
   * @param name - Path relative to the root with `/` separators.
   * @param path - The path the file was read from.
   * @param raw - The file contents.
   * @param digest - Lowercase hex SHA-256 of the contents.
   * @param chunks - The parsed chunks (see {@link extract}).
   * @param options - Escaping mode.
   */
  constructor(
    /** Path relative to the root, e.g. `pages/home.html`. */
    public name: string,
    /** The path the file was read from (`root` joined with `name`). */
    public path: string,
    /** The file contents. */
    public raw: string,
    /** Lowercase hex SHA-256 of the contents. */
    public digest: string,
    /** The parsed chunks. */
    public chunks: Chunk[],
    options: LoadOptions = {}
  ) {
    this.renderer = compile(chunks, { escape: options.escape });
  }

  /**
   * Render the template with `params`.
   * @param params - Values for the placeholders.
   * @returns The bound HTML.
   */
  bind(params?: Params): string {
    return this.renderer(params);
  }

  /**
   * Same as {@link Template.bind}.
   * @param params - Values for the placeholders.
   * @returns The bound HTML.
   */
  render(params?: Params): string {
    return this.renderer(params);
  }
}

function inside(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Load one template. Errors name the template, never the full path: a file
 * that resolves (through a symlink) outside `rootDir`, or that is larger than
 * `maxBytes`, is refused.
 *
 * @param rootDir - The template root.
 * @param relPath - Path of the file relative to `rootDir`.
 * @param options - Escaping mode and size limit.
 * @returns The parsed template.
 * @throws {@link AnzaError} `NOT_FOUND` when the file cannot be read or lies
 *   outside the root; `TEMPLATE` when it is too large or does not parse.
 *
 * @category Engine
 */
export async function one(rootDir: string, relPath: string, options: LoadOptions = {}): Promise<Template> {
  const name = relPath.split(path.sep).join('/').replace(/^\/+/, '');
  const fullPath = path.join(rootDir, relPath);
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_TEMPLATE_BYTES;
  let real: string;
  let realRoot: string;
  try {
    [real, realRoot] = await Promise.all([fs.realpath(fullPath), fs.realpath(rootDir)]);
  } catch (err: any) {
    throw AnzaError.notFound(`Failed to read template '${name}': ${err?.code ?? 'error'}`);
  }
  if (!inside(realRoot, real)) throw AnzaError.notFound(`Template '${name}' is outside the template root`);

  let handle: fs.FileHandle | undefined;
  let bytes: Buffer;
  try {
    handle = await fs.open(real, 'r');
    const buf = Buffer.alloc(maxBytes + 1);
    let total = 0;
    while (total < buf.length) {
      const { bytesRead } = await handle.read(buf, total, buf.length - total, total);
      if (bytesRead === 0) break;
      total += bytesRead;
    }
    bytes = buf.subarray(0, total);
  } catch (err: any) {
    throw AnzaError.notFound(`Failed to read template '${name}': ${err?.code ?? 'error'}`);
  } finally {
    await handle?.close();
  }
  if (bytes.length > maxBytes) throw AnzaError.template(`Template '${name}' is larger than ${maxBytes} bytes`);

  const raw = bytes.toString('utf8');
  return new Template(name, fullPath, raw, digest.hex(raw), extract(raw), options);
}

/**
 * Load every `.html` file under `rootDir`. Symlinked directories are not
 * followed, and symlinked files that resolve outside `rootDir` are skipped.
 * A missing root gives an empty map.
 *
 * @param rootDir - The template root.
 * @param options - Escaping mode and size limit.
 * @returns Template name to parsed template.
 * @throws {@link AnzaError} `TEMPLATE` or `NOT_FOUND` from {@link one} for
 *   the first file that fails.
 *
 * @category Engine
 */
export async function all(rootDir: string, options: LoadOptions = {}): Promise<Map<string, Template>> {
  const map = new Map<string, Template>();
  let realRoot: string;
  try {
    realRoot = await fs.realpath(rootDir);
  } catch {
    return map;
  }

  async function walk(currentDir: string) {
    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (!entry.name.endsWith('.html')) continue;
      if (entry.isSymbolicLink()) {
        const target = await fs.realpath(fullPath).catch(() => null);
        if (!target || !inside(realRoot, target)) continue;
        const stat = await fs.stat(target).catch(() => null);
        if (!stat?.isFile()) continue;
      } else if (!entry.isFile()) {
        continue;
      }
      const tpl = await one(rootDir, path.relative(rootDir, fullPath), options);
      map.set(tpl.name, tpl);
    }
  }

  await walk(rootDir);
  return map;
}
