/**
 * A rendered full HTML page, returned by {@link Page.run} and
 * {@link Engine.renderPage}. Send {@link Document.html | html} as the
 * response body (the adapters accept a `Document` directly).
 *
 * @example
 * ```ts
 * const doc = await new Page('/', { title: 'Home' }).run(engine);
 * return htmlResponse(doc); // text/html; charset=utf-8
 * ```
 *
 * @category Rendering
 */
export class Document {
  /**
   * @param html - The complete HTML document.
   */
  constructor(
    /** The complete HTML document, starting with `<!DOCTYPE html>` when a shell or the default document is used. */
    public html: string
  ) {}

  /** The HTML, so a `Document` can be used where a string is expected. */
  toString(): string {
    return this.html;
  }

  /** The HTML encoded as UTF-8 bytes. */
  toUint8Array(): Uint8Array {
    return new TextEncoder().encode(this.html);
  }
}
