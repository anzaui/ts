/**
 * Template name to content digest, returned by {@link Engine.manifest}.
 *
 * Digests are lowercase hex SHA-256 of the file contents, the same in the
 * Rust and Python engines, so manifests match across engines for the same
 * files. Use them for cache busting or to check that two servers loaded the
 * same templates.
 *
 * @example
 * ```ts
 * const manifest = engine.manifest();
 * for (const [name, digest] of Object.entries(manifest.templates)) {
 *   console.log(`${name} -> ${digest.slice(0, 12)}`);
 * }
 * ```
 *
 * @category Engine
 */
export class Manifest {
  /** Template name (e.g. `feed/card.html`) to lowercase hex SHA-256 digest. */
  public templates: Record<string, string> = {};

  /**
   * Record the digest of a template.
   * @param name - Template name relative to the root.
   * @param digest - Lowercase hex SHA-256 of the template contents.
   */
  insert(name: string, digest: string): void {
    this.templates[name] = digest;
  }

  /**
   * The digest of `name`, or `undefined` when it is not in the manifest.
   * @param name - Template name relative to the root.
   */
  get(name: string): string | undefined {
    return this.templates[name];
  }
}
