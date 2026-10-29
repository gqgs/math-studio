import {
  Mesh, OrthographicCamera, PlaneGeometry, Scene,
  WebGPURenderer, MeshBasicNodeMaterial,
} from 'three/webgpu';
import { mix, sin, uniform, uv, vec3 } from 'three/tsl';

// Keep the TSL shader graph in JavaScript: the extremely deep node expression
// types impose a disproportionate cost on application-wide TypeScript checking.
// The boundary is typed in shaderRuntime.d.ts.
export async function mountShader(host, options) {
  const { backend, signal, onStatus, getPlayback } = options;
  if (signal.aborted) return null;

  let renderer;
  let geometry;
  let material;
  let observer;
  try {
    renderer = new WebGPURenderer({
      antialias: true,
      forceWebGL: backend === 'webgl',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    await renderer.init();
    if (signal.aborted) {
      await renderer.dispose();
      return null;
    }

    const frequency = uniform(options.frequency);
    const curvature = uniform(options.curvature);
    const phase = uniform(0);
    const p = uv().sub(0.5).mul(2);
    const a = p.x.mul(frequency).add(p.y.mul(p.y).mul(curvature).mul(7)).add(phase);
    const b = p.y.mul(frequency).mul(0.75)
      .sub(p.x.mul(p.x).mul(curvature).mul(9)).sub(phase.mul(0.8));
    const c = p.x.add(p.y).mul(frequency).mul(0.45).add(phase.mul(0.35));
    const amplitude = sin(a).add(sin(b)).add(sin(c)).div(3);
    const intensity = amplitude.mul(amplitude).mul(0.96);

    material = new MeshBasicNodeMaterial();
    material.colorNode = mix(vec3(0.025, 0.045, 0.09), vec3(1, 0.7, 0.37),
      intensity);
    geometry = new PlaneGeometry(2, 2);
    const scene = new Scene();
    scene.add(new Mesh(geometry, material));

    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 10);
    camera.position.z = 2;
    host.appendChild(renderer.domElement);

    const resize = () => {
      renderer.setSize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight));
    };
    observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const isWebGPU = renderer.backend?.isWebGPUBackend === true;
    onStatus(isWebGPU ? 'WebGPU · TSL → WGSL' : 'WebGL 2 · TSL → GLSL');

    let previous = performance.now();
    renderer.setAnimationLoop(() => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      const { playing, speed } = getPlayback();
      if (playing) phase.value += dt * speed;
      renderer.render(scene, camera);
    });

    let disposed = false;
    return {
      setParameters(nextFrequency, nextCurvature) {
        frequency.value = nextFrequency;
        curvature.value = nextCurvature;
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        observer.disconnect();
        renderer.setAnimationLoop(null);
        renderer.domElement.remove();
        geometry.dispose();
        material.dispose();
        void renderer.dispose();
      },
    };
  } catch (error) {
    observer?.disconnect();
    renderer?.setAnimationLoop(null);
    renderer?.domElement.remove();
    geometry?.dispose();
    material?.dispose();
    if (renderer) void renderer.dispose();
    throw error;
  }
}
