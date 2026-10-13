/**
 * The error codes an {@link AnzaError} can carry. They are the same in the
 * Rust, TypeScript and Python engines (see the
 * [Engine Contract](https://github.com/anzaui/anza/blob/main/docs/engines/contract.md)).
 *
 * | Code | Raised when |
 * |---|---|
 * | `VALIDATION` | A request or name is malformed: empty route, empty template or slot, a template name with `..`, `\`, NUL or a leading `/`, a missing template root. |
 * | `NOT_FOUND` | An unknown page or template, or a fragment outside the `fragments` allowlist. Also unreadable files at load time. |
 * | `TEMPLATE` | A template cannot be parsed (unclosed `{{` / `{{{`, empty `{{}}`) or is larger than `maxTemplateBytes`. |
 * | `CRYPTO` | A signing key is missing or malformed at setup, key derivation fails, or {@link verifyEnvelope} rejects an envelope. |
 * | `INTERNAL` | An unexpected failure inside the engine. |
 *
 * @category Errors
 */
export type ErrorCode = 'VALIDATION' | 'NOT_FOUND' | 'TEMPLATE' | 'CRYPTO' | 'INTERNAL';

/**
 * The only error type the engine throws (or rejects with). Branch on
 * {@link AnzaError.code | code}, not on the message: messages are for logs
 * and may change.
 *
 * The message is prefixed with the code, e.g. `[Anza:NOT_FOUND] Page not found`.
 * Error messages never contain the request route, absolute file paths or key
 * material.
 *
 * @example Map engine errors to HTTP responses
 * ```ts
 * import { AnzaError, Page, htmlResponse } from '@anzaui/engine';
 *
 * try {
 *   return htmlResponse(await new Page(url.pathname).run(engine));
 * } catch (err) {
 *   if (err instanceof AnzaError && err.code === 'NOT_FOUND') {
 *     return new Response('Not Found', { status: 404 });
 *   }
 *   if (err instanceof AnzaError && err.code === 'VALIDATION') {
 *     return new Response('Bad Request', { status: 400 });
 *   }
 *   throw err;
 * }
 * ```
 *
 * @category Errors
 */
export class AnzaError extends Error {
  /**
   * @param code - The error category, see {@link ErrorCode}.
   * @param message - A human-readable description; it is prefixed with `[Anza:<code>]`.
   */
  constructor(
    /** The error category. Stable across releases and engines. */
    public code: ErrorCode,
    message: string
  ) {
    super(`[Anza:${code}] ${message}`);
    this.name = 'AnzaError';
  }

  /**
   * A `VALIDATION` error.
   * @param msg - Description of the invalid input.
   */
  static validation(msg: string): AnzaError {
    return new AnzaError('VALIDATION', msg);
  }

  /**
   * A `NOT_FOUND` error.
   * @param msg - Description of what was not found.
   */
  static notFound(msg: string): AnzaError {
    return new AnzaError('NOT_FOUND', msg);
  }

  /**
   * A `TEMPLATE` error.
   * @param msg - Description of the template problem.
   */
  static template(msg: string): AnzaError {
    return new AnzaError('TEMPLATE', msg);
  }

  /**
   * A `CRYPTO` error.
   * @param msg - Description of the failed key or signature check.
   */
  static crypto(msg: string): AnzaError {
    return new AnzaError('CRYPTO', msg);
  }

  /**
   * An `INTERNAL` error.
   * @param msg - Description of the failure.
   */
  static internal(msg: string): AnzaError {
    return new AnzaError('INTERNAL', msg);
  }
}
