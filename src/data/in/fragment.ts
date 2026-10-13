import { AnzaError } from '../../errors/index.js';
import type { Engine } from '../../engine/cache/engine.js';
import type { Params } from '../../engine/slot/index.js';
import type { Envelope } from '../../models/envelope.js';

/**
 * A fragment render request: validates the template and slot, then calls
 * {@link Engine.renderFragment} and returns an {@link Envelope} for `fetch`
 * responses and partial updates.
 *
 * @remarks
 * The engine looks the template up in its cache, checks the `fragments`
 * allowlist, binds `params`, stamps the current time and, when signing is on,
 * signs the v2 message. A template outside the allowlist is reported exactly
 * like a missing one (`NOT_FOUND`).
 *
 * Values are not HTML-escaped unless the engine runs with `escape: true`:
 * escape untrusted input with {@link escapeHtml} before binding it.
 *
 * @example
 * ```ts
 * import { Fragment, jsonResponse } from '@anzaui/engine';
 *
 * const envelope = await new Fragment('feed/card.html', 'feed', {
 *   title: 'New Event Received',
 *   status: 'processed',
 * }).run(engine);
 * return jsonResponse(envelope);
 * // {"v":2,"slot":"feed","ts":…,"html":"…","sig":"…"}
 * ```
 *
 * @category Rendering
 */
export class Fragment {
  /**
   * @param template - Template name relative to the root, e.g. `feed/card.html`.
   * @param slot - The target name written into the envelope.
   * @param params - Values for the template placeholders.
   */
  constructor(
    /** Template name relative to the root. */
    public template: string,
    /** The target name written into the envelope. */
    public slot: string,
    /** Values for the template placeholders. */
    public params?: Params
  ) {}

  /**
   * Check the request.
   * @throws {@link AnzaError} `VALIDATION` when the template or slot is empty.
   */
  validate(): void {
    if (!this.template) {
      throw AnzaError.validation('Template cannot be empty');
    }
    if (!this.slot) {
      throw AnzaError.validation('Slot cannot be empty');
    }
  }

  /**
   * Validate and render the envelope.
   * @param engine - The engine from {@link Setup.run}.
   * @returns The (signed, when signing is on) envelope.
   * @throws {@link AnzaError} `VALIDATION` for an empty or malformed name or
   *   slot; `NOT_FOUND` for an unknown template or one outside the allowlist.
   */
  async run(engine: Engine): Promise<Envelope> {
    this.validate();
    return engine.renderFragment(this.template, this.slot, this.params);
  }
}
