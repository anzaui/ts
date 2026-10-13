// TypeDoc plugin for the Anza theme.
//
// 1. The package entry (src/index.ts) is merged into the project with
//    `@mergeModuleWith <project>` so its categories (Engine, Rendering, …) are
//    the top level of the sidebar. TypeDoc drops a merged module's comment, so
//    its `@packageDocumentation` (the guide) is moved to the project first; it
//    is rendered on modules.html, next to the README landing on index.html.
// 2. Copies the self-hosted fonts (and their OFL licence) next to
//    assets/custom.css, which loads them with @font-face.
import { cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Converter, ReflectionKind, RendererEvent } from 'typedoc';

const fonts = join(dirname(fileURLToPath(import.meta.url)), 'fonts');

/** @param {import('typedoc').Application} app */
export function load(app) {
  app.converter.on(
    Converter.EVENT_RESOLVE_BEGIN,
    (context) => {
      const project = context.project;
      for (const mod of project.getReflectionsByKind(ReflectionKind.SomeModule)) {
        const tag = mod.comment?.getTag('@mergeModuleWith');
        if (!tag || tag.content.map((p) => p.text).join('').trim() !== '<project>' || project.comment) continue;
        const comment = mod.comment.clone();
        comment.removeTags('@mergeModuleWith');
        comment.removeTags('@module');
        comment.removeModifier('@packageDocumentation');
        project.comment = comment;
      }
    },
    2e4 // before TypeDoc's MergeModuleWithPlugin (1e4)
  );

  app.renderer.on(RendererEvent.END, (event) => {
    cpSync(fonts, join(event.outputDirectory, 'assets', 'fonts'), { recursive: true });
  });
}
