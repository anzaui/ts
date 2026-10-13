import { AnzaError } from '../../errors/index.js';
import type { Engine } from '../../engine/cache/engine.js';
import type { Params } from '../../engine/slot/index.js';
import type { Document } from '../../models/document.js';

/**
 * A full-page render request: validates the route, then calls
 * {@link Engine.renderPage}.
 *
 * @remarks
 * A page render returns a complete HTML {@link Document} for the first load.
 * The route maps to a template under `pages/` (see {@link pageTemplate}):
 *
 * 1. `/` is `pages/home.html`; `/article` and `/article/` are `pages/article.html`.
 * 2. If that template is not loaded, `pages/index.html` is used as the
 *    catch-all when it exists.
 * 3. Otherwise, or when the route is not a valid name (`..`, `\`, NUL), the
 *    render rejects with `NOT_FOUND` (`Page not found`). The route is never
 *    echoed into the error or the HTML.
 * 4. The page is bound with `params`. If `layout/shell.html` exists it is
 *    bound with the same params plus `content` set to the page HTML (the
 *    engine's `content` wins over a `content` param). Otherwise the page goes
 *    into a minimal default `<!DOCTYPE html>` document whose
 *    `<body>` holds a `<dock-main>` with an open shadow root.
 *
 * Routes only resolve under `pages/`: a route can never render a fragment or
 * the layout. There is no route-parameter matching (`/article/my-slug` looks
 * for `pages/article/my-slug.html`).
 *
 * Templates can use open Declarative Shadow DOM
 * (`<template shadowrootmode="open">`) so shadow roots and scoped styles exist
 * before any script runs; the engine does not add them to your templates
 * (except in the default document).
 *
 * @example
 * ```ts
 * import { AnzaError, Page, htmlResponse } from '@anzaui/engine';
 *
 * try {
 *   const doc = await new Page('/article', { title: 'Deep Dive into STUI' }).run(engine);
 *   return htmlResponse(doc);
 * } catch (err) {
 *   if (err instanceof AnzaError && err.code === 'NOT_FOUND') return new Response('Not Found', { status: 404 });
 *   throw err;
 * }
 * ```
 *
 * @category Rendering
 */
export class Page {
  /**
   * @param route - The request path, e.g. `/` or `/docs/intro`.
   * @param params - Values for the page and shell placeholders.
   */
  constructor(
    /** The request path. */
    public route: string,
    /** Values for the page and shell placeholders. */
    public params?: Params
  ) {}

  /**
   * Check the request.
   * @throws {@link AnzaError} `VALIDATION` when the route is empty.
   */
  validate(): void {
    if (!this.route) {
      throw AnzaError.validation('Route cannot be empty');
    }
  }

  /**
   * Validate and render the page.
   * @param engine - The engine from {@link Setup.run}.
   * @returns The full HTML document.
   * @throws {@link AnzaError} `VALIDATION` for an empty route; `NOT_FOUND`
   *   for an unknown or malformed route without a `pages/index.html` catch-all.
   */
  async run(engine: Engine): Promise<Document> {
    this.validate();
    return engine.renderPage(this.route, this.params);
  }
}
