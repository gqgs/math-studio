/// <reference lib="webworker" />
import { createTypstCompiler } from '@myriaddreamin/typst.ts/compiler';
import { createTypstRenderer } from '@myriaddreamin/typst.ts/renderer';
import { loadFonts } from '@myriaddreamin/typst.ts/options.init';
import compilerWasm from '@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm?url';
import rendererWasm from '@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm?url';
import { formulaDocument } from './math';
import type { RenderRequest, WorkerResponse } from './render-types';

const worker = self as unknown as DedicatedWorkerGlobalScope;
const compiler = createTypstCompiler();
const renderer = createTypstRenderer();
const send = (message: WorkerResponse) => worker.postMessage(message);
const fontUrl = (name: string) =>
  new URL(`${import.meta.env.BASE_URL}fonts/${name}`, worker.location.origin).href;

async function initialize() {
  await Promise.all([
    compiler.init({
      getModule: () => compilerWasm,
      beforeBuild: [
        loadFonts([fontUrl('NewCMMath-Regular.otf'), fontUrl('NewCM10-Regular.otf')], {
          assets: false,
        }),
      ],
    }),
    renderer.init({ getModule: () => rendererWasm }),
  ]);
  send({ type: 'ready' });
}

worker.onmessage = async ({ data }: MessageEvent<RenderRequest>) => {
  if (data.type !== 'render') return;
  const { source, revision, blockId } = data;
  try {
    compiler.addSource('/main.typ', formulaDocument(source));
    // This API releases the compiler snapshot after every edit.
    const result = await compiler.runWithWorld({ mainFilePath: '/main.typ' }, (world) =>
      world.vector({ diagnostics: 'full' }),
    );
    const diagnostics = (result.diagnostics ?? [])
      .filter((diagnostic) => diagnostic.severity === 'error')
      .map(({ message, range }) => ({ message, range }));
    if (!result.result) {
      send({
        type: 'result',
        revision,
        blockId,
        source,
        diagnostics: diagnostics.length
          ? diagnostics
          : [
              {
                message: 'This formula is incomplete. Check its brackets and symbol names.',
                range: '',
              },
            ],
      });
      return;
    }
    const svg = await renderer.renderSvg({
      artifactContent: result.result,
      format: 'vector',
      data_selection: { body: true, defs: true, css: true, js: false },
    });
    send({ type: 'result', revision, blockId, source, svg, diagnostics });
  } catch (error) {
    send({
      type: 'result',
      revision,
      blockId,
      source,
      diagnostics: [
        {
          message: error instanceof Error ? error.message : 'Unable to render this formula.',
          range: '',
        },
      ],
    });
  }
};

initialize().catch((error) =>
  send({
    type: 'fatal',
    message: error instanceof Error ? error.message : 'Could not load the math renderer.',
  }),
);
