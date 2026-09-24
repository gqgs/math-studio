import { useEffect, useMemo, useRef, useState } from 'react';
import { splitFormulas } from './math';
import { RenderEngine, type RenderSnapshot, type WorkerPort } from './render-engine';

export function useRenderer(source: string, composing: boolean) {
  const engine = useRef<RenderEngine | null>(null);
  const blocks = useMemo(() => splitFormulas(source), [source]);
  const [snapshot, setSnapshot] = useState<RenderSnapshot>({
    state: 'loading',
    results: new Map(),
  });
  useEffect(() => {
    const instance = new RenderEngine(
      () =>
        new Worker(new URL('./typst.worker.ts', import.meta.url), {
          type: 'module',
        }) as unknown as WorkerPort,
      setSnapshot,
    );
    engine.current = instance;
    return () => {
      instance.dispose();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    if (composing) return;
    const timeout = setTimeout(() => engine.current?.setBlocks(blocks), 150);
    return () => clearTimeout(timeout);
  }, [blocks, composing]);
  return { ...snapshot, blocks, retry: () => engine.current?.retry() };
}
