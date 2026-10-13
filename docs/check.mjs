#!/usr/bin/env node
/**
 * docs/check.mjs — browser smoke test for a built static docs site.
 *
 * Serves the site under BASE (the GitHub Pages sub-path), loads the home page
 * and every page linked from its sidebar in headless Chrome, and fails on:
 * JavaScript errors, console errors, failed or 4xx/5xx requests, a loader
 * still visible after load, a hidden <body>, a missing content heading, or a
 * sidebar click that doesn't load a different page.
 *
 * Usage: node docs/check.mjs <site dir> <base> [nav selector] [heading selector]
 *        e.g. node docs/check.mjs _site /ts
 *
 * Options (argument or environment variable, argument wins):
 *   nav selector      NAV_SELECTOR      links to crawl and click
 *                                       (default: TypeDoc's sidebar, `.site-menu .tsd-navigation a`)
 *   heading selector  HEADING_SELECTOR  the content heading every page must have
 *                                       (default: `.col-content h1`)
 *
 * Needs: puppeteer-core (PUPPETEER_CORE = path to its ESM entry) and Chrome
 * (CHROME_PATH, default /usr/bin/google-chrome).
 */

import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const siteDir = resolve(args[0] ?? '_site');
const base = (args[1] ?? '').replace(/\/+$/, '');
const NAV = args[2] || process.env.NAV_SELECTOR || '.site-menu .tsd-navigation a';
const HEADING = args[3] || process.env.HEADING_SELECTOR || '.col-content h1';

if (!process.env.PUPPETEER_CORE) {
  console.error('docs check: set PUPPETEER_CORE to the puppeteer-core ESM entry');
  process.exit(2);
}
const puppeteer = (await import(pathToFileURL(process.env.PUPPETEER_CORE).href)).default;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
};

// Static server that behaves like GitHub Pages under a sub-path.
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith(base + '/') && url.pathname !== base) return res.writeHead(404).end();
  const rel = decodeURIComponent(url.pathname.slice(base.length)) || '/';
  let file = normalize(join(siteDir, rel));
  if (!file.startsWith(siteDir)) return res.writeHead(404).end();
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!rel.endsWith('/')) return res.writeHead(301, { location: url.pathname + '/' }).end();
    file = join(file, 'index.html');
  }
  if (!existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const problems = [];

/** The page's state: heading, visible loaders, body visibility and in-site nav links. */
function inspect(page) {
  return page.evaluate(
    (nav, heading, prefix) => {
      const visible = (el) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0' && r.width > 0 && r.height > 0;
      };
      const links = [...document.querySelectorAll(nav)]
        .map((a) => new URL(a.href, location.href))
        .filter((u) => u.origin === location.origin && u.pathname.startsWith(prefix))
        .map((u) => u.pathname);
      return {
        heading: document.querySelector(heading)?.textContent?.trim(),
        content: document.body.innerText.slice(0, 2000),
        bodyVisible: visible(document.body),
        loaders: [...document.querySelectorAll('[class*="loading" i],[aria-busy="true"],ui-spinner')].filter(visible).length,
        links,
      };
    },
    NAV,
    HEADING,
    base + '/'
  );
}

function watch(page, issues) {
  page.on('pageerror', (e) => issues.push(`JS error: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && issues.push(`console error: ${m.text()}`));
  page.on('requestfailed', (r) => issues.push(`request failed: ${r.url()}`));
  page.on('response', (r) => r.status() >= 400 && issues.push(`HTTP ${r.status()}: ${r.url()}`));
}

function verify(state, issues) {
  if (!state.heading) issues.push(`no content heading (${HEADING})`);
  if (!state.bodyVisible) issues.push('<body> is still hidden');
  if (state.loaders) issues.push(`${state.loaders} loader(s) still visible`);
}

async function visit(path) {
  const page = await browser.newPage();
  const issues = [];
  watch(page, issues);
  await page.goto(origin + path, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 700));
  const state = await inspect(page);
  verify(state, issues);
  return { page, issues, state };
}

const home = base + '/';
const first = await visit(home);
const links = [...new Set(first.state.links)].filter((p) => p !== home && p !== base + '/index.html');
if (!links.length) first.issues.push(`no sidebar links (${NAV})`);
problems.push(...first.issues.map((i) => `${home}: ${i}`));

// Click a visible sidebar link on the home page; it must load another page.
const handles = await first.page.$$(NAV);
let clicked = false;
for (const handle of handles) {
  const target = await handle.evaluate((a) => {
    const r = a.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(a).visibility !== 'hidden' ? new URL(a.href, location.href).pathname : null;
  });
  if (!target || !links.includes(target)) continue;
  const before = first.state.content;
  await Promise.all([first.page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => null), handle.click()]);
  await new Promise((r) => setTimeout(r, 500));
  const after = await inspect(first.page);
  const path = new URL(first.page.url()).pathname;
  if (path !== target) problems.push(`sidebar click on ${target} ended at ${path}`);
  else if (!after.heading || after.content === before) problems.push(`sidebar click on ${target} did not render a new page`);
  clicked = true;
  break;
}
if (links.length && !clicked) problems.push('no visible sidebar link to click');
await first.page.close();

// Hard load of every page in the sidebar.
for (const href of links) {
  const { page, issues } = await visit(href);
  problems.push(...issues.map((i) => `${href}: ${i}`));
  await page.close();
}

await browser.close();
server.close();
if (problems.length) {
  console.error(`docs check: ${problems.length} problem(s)\n` + problems.map((p) => '  ' + p).join('\n'));
  process.exit(1);
}
console.log(`docs check: ok (${links.length + 1} pages, sidebar navigation works)`);
