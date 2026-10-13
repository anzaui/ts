<p align="center">
  <img src="logo.svg" width="64" height="64" alt="Anza Logo" />
</p>

<h1 align="center">Anza (TypeScript Engine)</h1>

A zero-dependency template and dynamic fragment rendering library for Node.js, Bun, Deno, and Edge runtimes.

## What It Does

1. **Full-Page Rendering**: Renders complete HTML pages with `<template shadowrootmode="open">` Declarative Shadow DOM templates.
2. **Dynamic Fragment Envelopes**: Generates signed JSON `Envelope` payloads to update specific client UI slots.
3. **Cryptographic Signing**: Signs envelopes with HMAC-SHA256 or Ed25519 (`node:crypto`) and verifies received ones with `verifyEnvelope`.
4. **Streaming**: Helpers for Server-Sent Events (SSE) and WebSocket message formats.
5. **No External Dependencies**: Built on Node.js built-ins (`node:fs`, `node:crypto`) and the standard `Response` class.

## Installation

```bash
npm install @anzaui/engine
```

## Usage

### 1. Initialize Engine

```typescript
import { Setup } from '@anzaui/engine';

const engine = await new Setup({
  root: './templates',
  signing: {
    mode: 'hmac',
    secret: process.env.ANZA_SECRET!, // at least 32 bytes
  },
}).run();
```

`Setup.run()` checks the key once. An HMAC secret shorter than 32 bytes, or an
Ed25519 `privateKey` that is not a 32-byte seed, 64-char lowercase hex seed,
PEM or `KeyObject`, throws an `AnzaError` with code `CRYPTO`. The engine never
falls back to unsigned envelopes.

### 2. Render Full Pages

```typescript
import { Page } from '@anzaui/engine';

const doc = await new Page('/', { title: 'Dashboard' }).run(engine);
console.log(doc.html);
```

### 3. Render Signed JSON Fragments

```typescript
import { Fragment } from '@anzaui/engine';

const envelope = await new Fragment('card.html', 'feed', {
  title: 'New Post',
  content: 'Article content here',
}).run(engine);

// {"v":2,"slot":"feed","ts":1724771234,"html":"…","sig":"…"}
console.log(JSON.stringify(envelope));
```

### 4. Verify a Received Envelope

```typescript
import { verifyEnvelope } from '@anzaui/engine';

// Throws an AnzaError (code CRYPTO) naming the failed check.
verifyEnvelope({ mode: 'hmac', secret: process.env.ANZA_SECRET! }, received, {
  maxAgeSecs: 60,
  slot: 'feed',
});
```

### 5. HTTP Server Example (Web Standard fetch / Bun / Deno)

```typescript
import { Setup, Page, Fragment, htmlResponse, jsonResponse } from '@anzaui/engine';

const engine = await new Setup({
  root: './templates',
  signing: { mode: 'hmac', secret: process.env.ANZA_SECRET! },
}).run();

export default {
  port: 3000,
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === '/') {
      const doc = await new Page('/', { title: 'Home' }).run(engine);
      return htmlResponse(doc);
    }

    if (url.pathname === '/api/card') {
      const env = await new Fragment('card.html', 'feed', { title: 'Card' }).run(engine);
      return jsonResponse(env);
    }

    return new Response('Not Found', { status: 404 });
  },
};
```

## Templates

Templates use `{{name}}` (value) and `{{{name}}}` (raw) placeholders and are
parsed once at startup. By default both insert values as-is, so escape user
input with `escapeHtml` first. With `escape: true` in `Setup`, `{{name}}` is
HTML-escaped and `{{{name}}}` stays raw. Unknown page routes reject with
`NOT_FOUND`. Template layout,
rendering rules and signing are in the [documentation](https://anzaui.github.io/ts/).

## Documentation

- Guide and API reference: https://anzaui.github.io/ts/
- [Engine Contract](https://github.com/anzaui/anza/blob/main/docs/engines/contract.md): the behaviour shared by
  the Rust, TypeScript and Python engines (envelope format, signature v2, page
  resolution, escaping, error codes). `tests/fixtures/` holds vendored copies
  of its golden fixtures.
- [Changelog](CHANGELOG.md)

The docs are markdown in `docs/` (pages and sidebar in `docs/config.toml`),
built with `anza docs` and deployed to GitHub Pages by
`.github/workflows/docs.yml`. To build them locally you need the
[Anza CLI](https://github.com/anzaui/anza/releases) and the anza repo's theme
in `.anza/`:

```bash
git clone --depth 1 --branch v0.6.0 https://github.com/anzaui/anza .anza
ANZA=/path/to/anza docs/build.sh     # writes _site/, served under /ts/
```

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
