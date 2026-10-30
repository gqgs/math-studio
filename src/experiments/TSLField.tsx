import { useEffect, useRef, useState } from 'react';
import type { ExpressionNode } from './expression';
import { mountShader, type ShaderHandle } from './shaderRuntime';

export function TSLField({
  expression, a, b, speed, playing, backend,
}: {
  expression: ExpressionNode;
  a: number;
  b: number;
  speed: number;
  playing: boolean;
  backend: 'auto' | 'webgl';
}) {
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<ShaderHandle | null>(null);
  const settings = useRef({ a, b, speed, playing });
  settings.current = { a, b, speed, playing };
  const [status, setStatus] = useState('Initializing renderer…');
  const [error, setError] = useState('');

  useEffect(() => {
    handle.current?.setParameters(a, b);
  }, [a, b]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const abort = new AbortController();
    setStatus('Compiling expression…');
    setError('');

    void mountShader(element, {
      expression,
      a: settings.current.a,
      b: settings.current.b,
      backend,
      signal: abort.signal,
      getPlayback: () => ({
        playing: settings.current.playing,
        speed: settings.current.speed,
      }),
      onStatus: (next) => {
        if (!abort.signal.aborted) setStatus(next);
      },
    }).then((created) => {
      if (!created) return;
      if (abort.signal.aborted) {
        created.dispose();
        return;
      }
      handle.current = created;
      created.setParameters(settings.current.a, settings.current.b);
    }).catch((cause: unknown) => {
      if (abort.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : 'Could not initialize shader');
      setStatus('Shader unavailable');
    });

    return () => {
      abort.abort();
      handle.current?.dispose();
      handle.current = null;
    };
  }, [backend, expression]);

  return (
    <div className="experiment-shader">
      <div ref={host} className="experiment-canvas"
        role="img" aria-label="Mathematical scalar field rendered by the GPU" />
      <div className="experiment-render-status" role="status">{status}</div>
      {error && <p role="alert" className="experiment-error">{error}. Check the formula or try WebGL 2.</p>}
      <p className="experiment-note">
        The formula evaluates a scalar field per pixel. Colors show clamped f(x,y,t,a,b)²,
        from dark to gold. This is an expression shader, not an ODE solver.
      </p>
    </div>
  );
}
