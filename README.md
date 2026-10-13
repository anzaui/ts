<p align="center">
  <img src="logo.svg" width="64" height="64" alt="Anza logo" />
</p>

<h1 align="center">@anzaui/engine</h1>

<p align="center">
  Server-templated UI for Node.js, Bun and Deno: full HTML pages for the first
  load, signed JSON envelopes for every update after it.
</p>

<p align="center">
  <a href="https://anzaui.github.io/ts/modules.html">Guide &amp; API</a> ·
  <a href="https://www.npmjs.com/package/@anzaui/engine">npm</a> ·
  <a href="https://github.com/anzaui/ts">GitHub</a> ·
  <a href="https://github.com/anzaui/anza/blob/main/docs/engines/contract.md">Engine Contract</a>
</p>

## What it does

1. **Full pages**: renders complete HTML documents (with open Declarative
   Shadow DOM where your templates use it) for the first load and SEO.
2. **Fragment envelopes**: renders `{ v: 2, slot, ts, html, sig? }` JSON to
   update one part of the page, over `fetch`, Server-Sent Events or WebSockets.
3. **Signing**: signs envelopes with HMAC-SHA256 or Ed25519 (`node:crypto`)
   over a length-prefixed v2 message, and checks received ones with
   `verifyEnvelope`.
4. **Parse once**: `{{name}}` / `{{{name}}}` templates are parsed at startup
   into render functions; request input never reaches the filesystem.
5. **No dependencies**: built on Node.js built-ins and the standard `Response`.

The behaviour is shared with the Rust and Python engines and specified in the
[Engine Contract](https://github.com/anzaui/anza/blob/main/docs/engines/contract.md).

## Install

```bash
npm install @anzaui/engine
```

## Quick start

```typescript
import { Setup, Page, Fragment, htmlResponse, jsonResponse, verifyEnvelope } from '@anzaui/engine';

// Load and parse ./templates once; a short or missing key throws CRYPTO here.
const engine = await new Setup({
  root: './templates',
  signing: { mode: 'hmac', secret: process.env.ANZA_SECRET! }, // at least 32 bytes
}).run();

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/api/card') {
      // {"v":2,"slot":"feed","ts":1724771234,"html":"…","sig":"…"}
      return jsonResponse(await new Fragment('feed/card.html', 'feed', { title: 'Card' }).run(engine));
    }
    // pages/home.html inside layout/shell.html
    return htmlResponse(await new Page(url.pathname, { title: 'Home' }).run(engine));
  },
};
```

Whoever relays an envelope can check it; `verifyEnvelope` throws an
`AnzaError` with code `CRYPTO` naming the failed check:

```typescript
verifyEnvelope({ mode: 'hmac', secret: process.env.ANZA_SECRET! }, JSON.parse(body), {
  maxAgeSecs: 60,
  slot: 'feed',
});
```

Values are **not HTML-escaped by default**: escape user input with
`escapeHtml`, or pass `escape: true` to `Setup` so `{{name}}` is escaped and
only `{{{name}}}` is raw. Unknown routes reject with an `AnzaError` of code
`NOT_FOUND`.

## Documentation

The guide and API reference are at **https://anzaui.github.io/ts/**. They are
generated from the TSDoc comments in `src/` with [TypeDoc](https://typedoc.org)
(`typedoc.json`, Anza theme in `docs/theme/`) and deployed to GitHub Pages by
`.github/workflows/docs.yml`. Warnings fail the build, so every public export
must be documented and every `{@link}` must resolve.

To build and check them locally:

```bash
npm ci
npm run docs                     # writes _site/
# optional browser check (needs Chrome and puppeteer-core):
PUPPETEER_CORE=/path/to/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js \
  node docs/check.mjs _site /ts   # serves _site under /ts/ like GitHub Pages
```

See also the [changelog](https://github.com/anzaui/ts/blob/main/CHANGELOG.md).

## Releasing

Versions are independent of the other engines and of the Anza CLI.
[release-please](https://github.com/googleapis/release-please) keeps a release
PR open from the conventional commits on `main` (version bump in
`package.json` and `package-lock.json`, plus a CHANGELOG entry).

1. Merge the release PR. release-please tags the commit `v<version>` and
   creates the GitHub release.
2. Publish to npm from that tag (`files` limits the package to `dist/src/`, the
   README, CHANGELOG, LICENSE and logo; `prepack` compiles again):

   ```bash
   git checkout v<version>
   npm ci && npm run build
   npm publish --access public
   ```

## License

MIT © 2026 aduki, Labs
