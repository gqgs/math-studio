import { useEffect, useRef, useState } from 'react';
import { mountShader, type ShaderHandle } from './shaderRuntime';

export function TSLField({
  frequency, curvature, speed, playing, backend,
}: {
  frequency: number;
  curvature: number;
  speed: number;
  playing: boolean;
  backend: 'auto' | 'webgl';
}) {
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<ShaderHandle | null>(null);
  const settings = useRef({ frequency, curvature, speed, playing });
  settings.current = { frequency, curvature, speed, playing };
  const [status, setStatus] = useState('Initializing renderer…');
  const [error, setError] = useState('');

  useEffect(() => {
    handle.current?.setParameters(frequency, curvature);
  }, [frequency, curvature]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const abort = new AbortController();
    setStatus('Initializing renderer…');
    setError('');

    void mountShader(element, {
      frequency: settings.current.frequency,
      curvature: settings.current.curvature,
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
      created.setParameters(settings.current.frequency, settings.current.curvature);
    }).catch((cause: unknown) => {
      if (abort.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : 'Could not initialize GPU renderer');
      setStatus('Renderer unavailable');
    });

    return () => {
      abort.abort();
      handle.current?.dispose();
      handle.current = null;
    };
  }, [backend]);

  return (
    <div className="experiment-shader">
      <div ref={host} className="experiment-canvas"
        role="img" aria-label="Animated interference field rendered by the GPU" />
      <div className="experiment-render-status" role="status">{status}</div>
      {error && <p role="alert" className="experiment-error">{error}. Try the WebGL 2 backend.</p>}
      <p className="experiment-note">
        A procedural field evaluated in a TSL shader. All pixels share the same
        mathematical expression; there are no precomputed frames.
      </p>
    </div>
  );
}
