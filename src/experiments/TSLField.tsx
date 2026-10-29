import { useEffect, useRef, useState } from 'react';
import { Mesh, OrthographicCamera, PlaneGeometry, Scene, WebGPURenderer, MeshBasicNodeMaterial } from 'three/webgpu';
import { mix, sin, uniform, uv, vec3 } from 'three/tsl';

type GPUControls = {
  frequency: { value: number };
  curvature: { value: number };
  phase: { value: number };
};

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
  const controls = useRef<GPUControls | null>(null);
  const speedRef = useRef(speed);
  const playingRef = useRef(playing);
  const [status, setStatus] = useState('Initializing renderer…');
  const [error, setError] = useState('');

  useEffect(() => {
    speedRef.current = speed;
    playingRef.current = playing;
  }, [speed, playing]);
  useEffect(() => {
    if (controls.current) {
      controls.current.frequency.value = frequency;
      controls.current.curvature.value = curvature;
    }
  }, [frequency, curvature]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false;
    let renderer: WebGPURenderer | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let geometry: PlaneGeometry | undefined;
    let material: MeshBasicNodeMaterial | undefined;
    setError('');
    setStatus('Initializing renderer…');

    async function start() {
      try {
        renderer = new WebGPURenderer({ antialias: true, forceWebGL: backend === 'webgl' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        await renderer.init();
        if (disposed || !element || !renderer) return;

        const freq = uniform(frequency);
        const bend = uniform(curvature);
        const phase = uniform(0);
        controls.current = { frequency: freq, curvature: bend, phase };

        // This is a shader graph, not a GLSL/WGSL string.
        // Three.js compiles the same TSL expression for either backend.
        const p = uv().sub(0.5).mul(2);
        const a = p.x.mul(freq).add(p.y.mul(p.y).mul(bend).mul(7)).add(phase);
        const b = p.y.mul(freq).mul(0.75).sub(p.x.mul(p.x).mul(bend).mul(9)).sub(phase.mul(0.8));
        const c = p.x.add(p.y).mul(freq).mul(0.45).add(phase.mul(0.35));
        const amplitude = sin(a).add(sin(b)).add(sin(c)).div(3);
        const intensity = amplitude.mul(amplitude).mul(0.96);
        material = new MeshBasicNodeMaterial();
        material.colorNode = mix(vec3(0.025, 0.045, 0.09), vec3(1, 0.7, 0.37), intensity);

        geometry = new PlaneGeometry(2, 2);
        const scene = new Scene();
        scene.add(new Mesh(geometry, material));
        const camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 10);
        camera.position.z = 2;

        element.appendChild(renderer.domElement);
        const resize = () => {
          if (!element || !renderer) return;
          renderer.setSize(Math.max(1, element.clientWidth), Math.max(1, element.clientHeight));
        };
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(element);
        resize();
        const isWebGPU = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend;
        setStatus(isWebGPU ? 'WebGPU · TSL → WGSL' : 'WebGL 2 · TSL → GLSL');

        let previous = performance.now();
        renderer.setAnimationLoop(() => {
          const now = performance.now();
          const dt = Math.min(0.05, (now - previous) / 1000);
          previous = now;
          if (playingRef.current) phase.value += dt * speedRef.current;
          renderer?.render(scene, camera);
        });
      } catch (cause) {
        if (!disposed) {
          setError(cause instanceof Error ? cause.message : 'Could not initialize GPU renderer');
          setStatus('Renderer unavailable');
        }
      }
    }

    void start();
    return () => {
      disposed = true;
      controls.current = null;
      resizeObserver?.disconnect();
      renderer?.setAnimationLoop(null);
      if (renderer) {
        renderer.domElement.remove();
        void renderer.dispose();
      }
      geometry?.dispose();
      material?.dispose();
    };
    // Recreate only when backend changes; parameter updates modify uniforms.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
