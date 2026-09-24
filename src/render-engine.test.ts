import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RenderEngine, type RenderSnapshot, type WorkerPort } from './render-engine';
import { splitFormulas } from './math';
import type { RenderRequest, WorkerResponse } from './render-types';

class FakeWorker implements WorkerPort {
  onmessage: WorkerPort['onmessage'] = null;
  onerror: WorkerPort['onerror'] = null;
  sent: RenderRequest[] = [];
  terminated = false;
  postMessage(message: RenderRequest) {
    this.sent.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  emit(data: WorkerResponse) {
    this.onmessage?.({ data } as MessageEvent<WorkerResponse>);
  }
  finish(svg = '<svg/>') {
    const request = this.sent.at(-1)!;
    this.emit({ ...request, type: 'result', svg, diagnostics: [] });
  }
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup() {
  const workers: FakeWorker[] = [];
  const snapshots: RenderSnapshot[] = [];
  const engine = new RenderEngine(
    () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
    (value) => snapshots.push(value),
  );
  return { engine, workers, snapshots };
}

it('waits for initialization, caches repeated formulas, and retains only the latest queued edit', () => {
  const { engine, workers } = setup();
  const worker = workers[0];
  engine.setBlocks(splitFormulas('x'));
  expect(worker.sent).toHaveLength(0);
  worker.emit({ type: 'ready' });
  engine.setBlocks(splitFormulas('y'));
  engine.setBlocks(splitFormulas('z\n\nz'));
  worker.finish();
  expect(worker.sent.map((item) => item.source)).toEqual(['x', 'z']);
  worker.finish();
  engine.setBlocks(splitFormulas('z\n\nx'));
  expect(worker.sent).toHaveLength(2);
  engine.dispose();
});

it('terminates a slow compiler, flags its formula, and resumes other blocks', () => {
  const { engine, workers, snapshots } = setup();
  engine.setBlocks(splitFormulas('slow\n\nx^2'));
  workers[0].emit({ type: 'ready' });
  vi.advanceTimersByTime(5000);
  expect(workers[0].terminated).toBe(true);
  expect(workers).toHaveLength(2);
  workers[0].finish('stale');
  expect(snapshots.at(-1)!.results.get('slow')?.svg).toBeUndefined();
  workers[1].emit({ type: 'ready' });
  expect(workers[1].sent[0].source).toBe('x^2');
  workers[1].finish();
  expect(snapshots.at(-1)!.results.get('slow')?.diagnostics[0].message).toContain('too long');
  expect(snapshots.at(-1)!.results.get('x^2')?.svg).toBe('<svg/>');
  engine.dispose();
});

it('supports retry after loading fails and cleans up timers on disposal', () => {
  const { engine, workers, snapshots } = setup();
  vi.advanceTimersByTime(30_000);
  expect(snapshots.at(-1)!.state).toBe('error');
  engine.retry();
  workers[1].emit({ type: 'ready' });
  expect(snapshots.at(-1)!.state).toBe('ready');
  engine.dispose();
  vi.advanceTimersByTime(30_000);
  expect(workers[1].terminated).toBe(true);
  expect(workers).toHaveLength(2);
});
