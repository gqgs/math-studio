import type { FormulaBlock } from './math';
import type { CompilerDiagnostic, RenderRequest, WorkerResponse } from './render-types';

export interface RenderResult {
  svg?: string;
  diagnostics: CompilerDiagnostic[];
}
export interface RenderSnapshot {
  state: 'loading' | 'ready' | 'working' | 'error';
  results: Map<string, RenderResult>;
  error?: string;
}
export interface WorkerPort {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: RenderRequest): void;
  terminate(): void;
}

/** One task at a time keeps the compiler isolated; only the latest edit is queued. */
export class RenderEngine {
  private worker!: WorkerPort;
  private timer?: ReturnType<typeof setTimeout>;
  private revision = 0;
  private blocks: FormulaBlock[] = [];
  private active?: RenderRequest;
  private ready = false;
  private disposed = false;
  private results = new Map<string, RenderResult>();
  private error?: string;

  constructor(
    private makeWorker: () => WorkerPort,
    private onChange: (snapshot: RenderSnapshot) => void,
  ) {
    this.start();
  }

  private publish() {
    if (!this.disposed)
      this.onChange({
        state: this.error ? 'error' : !this.ready ? 'loading' : this.active ? 'working' : 'ready',
        results: new Map(this.results),
        error: this.error,
      });
  }

  private start() {
    this.ready = false;
    this.error = undefined;
    try {
      const worker = (this.worker = this.makeWorker());
      this.timer = setTimeout(
        () => this.fail('The math renderer took too long to load. Please retry.'),
        30_000,
      );
      worker.onmessage = ({ data }) => {
        if (this.disposed || worker !== this.worker) return;
        if (data.type === 'ready') {
          clearTimeout(this.timer);
          this.ready = true;
          this.next();
        } else if (data.type === 'fatal') {
          this.fail('Could not load the math renderer. Check your connection and retry.');
        } else if (
          this.active &&
          data.revision === this.active.revision &&
          data.blockId === this.active.blockId
        ) {
          clearTimeout(this.timer);
          this.cache(data.source, { svg: data.svg, diagnostics: data.diagnostics });
          this.active = undefined;
          this.next();
        }
      };
      worker.onerror = () =>
        this.fail('The math renderer stopped unexpectedly. Your draft is safe.');
    } catch {
      this.fail('Could not start the math renderer. Please retry.');
    }
    this.publish();
  }

  private cache(source: string, result: RenderResult) {
    this.results.delete(source);
    this.results.set(source, result);
    // Keep current formulas plus a small history, without unbounded SVG retention.
    const current = new Set(this.blocks.map((block) => block.source));
    for (const key of this.results.keys()) {
      if (this.results.size <= Math.max(100, current.size)) break;
      if (!current.has(key)) this.results.delete(key);
    }
  }

  private fail(message: string) {
    clearTimeout(this.timer);
    this.worker?.terminate();
    this.ready = false;
    this.active = undefined;
    this.error = message;
    this.publish();
  }

  setBlocks(blocks: FormulaBlock[]) {
    this.blocks = blocks;
    this.revision++;
    this.next();
  }

  private next() {
    if (this.disposed || !this.ready || this.active || this.error) {
      this.publish();
      return;
    }
    const block = this.blocks.find((item) => !this.results.has(item.source));
    if (block) {
      const request: RenderRequest = {
        type: 'render',
        revision: this.revision,
        blockId: block.id,
        source: block.source,
      };
      this.active = request;
      this.timer = setTimeout(() => {
        this.cache(request.source, {
          diagnostics: [
            {
              message: 'This formula took too long to render. Simplify it and try again.',
              range: '',
            },
          ],
        });
        this.worker.terminate();
        this.active = undefined;
        this.start();
      }, 5_000);
      this.worker.postMessage(request);
    }
    this.publish();
  }

  retry() {
    clearTimeout(this.timer);
    this.worker?.terminate();
    this.active = undefined;
    for (const [key, value] of this.results) if (!value.svg) this.results.delete(key);
    this.start();
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    this.worker?.terminate();
  }
}
