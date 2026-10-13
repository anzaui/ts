/**
 * Whether `name` is a well-formed template name.
 *
 * @remarks
 * A template name is a relative, `/`-separated path under the template root:
 * not empty, no leading `/`, no backslash or NUL, and no empty, `.` or `..`
 * segment. Names are only ever looked up in the in-memory cache, so request
 * input never reaches the filesystem (see the
 * [Engine Contract](https://github.com/anzaui/anza/blob/main/docs/engines/contract.md)).
 *
 * @param name - The name to check.
 * @returns `true` when `name` is well-formed.
 *
 * @example
 * ```ts
 * validName('feed/card.html');   // true
 * validName('../secret.html');   // false
 * validName('/abs.html');        // false
 * ```
 *
 * @category Engine
 */
export function validName(name: string): boolean {
  if (typeof name !== 'string' || name === '' || name.startsWith('/') || name.includes('\\') || name.includes('\0')) {
    return false;
  }
  return name.split('/').every((seg) => seg !== '' && seg !== '.' && seg !== '..');
}

/**
 * The page template for a request route: `/` is `pages/home.html`, `/a/b` is
 * `pages/a/b.html` (leading and trailing slashes are ignored).
 *
 * @param route - The request path.
 * @returns The template name, or `null` when the route is not a valid name.
 *
 * @example
 * ```ts
 * pageTemplate('/');           // 'pages/home.html'
 * pageTemplate('/docs/intro/'); // 'pages/docs/intro.html'
 * pageTemplate('/../etc');     // null
 * ```
 *
 * @category Rendering
 */
export function pageTemplate(route: string): string | null {
  const clean = String(route).replace(/^\/+|\/+$/g, '');
  if (clean === '') return 'pages/home.html';
  return validName(clean) ? `pages/${clean}.html` : null;
}

/**
 * Whether a fragment may render `name` under the `fragments` allowlist: empty
 * allows every template; an entry ending in `/` allows that prefix, any other
 * entry allows that exact name.
 *
 * @param list - The allowlist ({@link SetupOptions.fragments}).
 * @param name - Template name.
 * @returns `true` when `name` may be rendered as a fragment.
 *
 * @example
 * ```ts
 * fragmentAllowed(['feed/', 'widgets/clock.html'], 'feed/card.html');    // true
 * fragmentAllowed(['feed/', 'widgets/clock.html'], 'layout/shell.html'); // false
 * fragmentAllowed([], 'anything.html');                                  // true
 * ```
 *
 * @category Rendering
 */
export function fragmentAllowed(list: readonly string[], name: string): boolean {
  return list.length === 0 || list.some((entry) => (entry.endsWith('/') ? name.startsWith(entry) : name === entry));
}
