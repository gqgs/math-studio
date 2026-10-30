import {
  Mesh, OrthographicCamera, PlaneGeometry, Scene,
  WebGPURenderer, MeshBasicNodeMaterial,
} from 'three/webgpu';
import {
  abs, acos, asin, atan, atan2, ceil, clamp, cos, exp, float, floor,
  fract, log, max, min, mix, pow, sign, sin, smoothstep, sqrt,
  tan, uniform, uv, vec3,
} from 'three/tsl';

// The deep TSL node graph stays in JS to avoid pathological TS inference costs.
// User expressions are *parsed* by expression.ts; no user text is executed.
const FUNCTIONS = Object.freeze({
  sin, cos, tan, asin, acos, atan, atan2, abs, sqrt, exp,
  log, ln: log, floor, ceil, fract, sign, min, max, pow,
  clamp, mix, smoothstep,
});

function toTSL(ast, variables) {
  switch (ast.kind) {
    case 'number':
      return float(ast.value);
    case 'variable':
      if (!Object.hasOwn(variables, ast.name)) throw new Error('Unknown variable');
      return variables[ast.name];
    case 'unary':
      return toTSL(ast.argument, variables).negate();
    case 'binary': {
      const left = toTSL(ast.left, variables);
      const right = toTSL(ast.right, variables);
      switch (ast.op) {
        case '+': return left.add(right);
        case '-': return left.sub(right);
        case '*': return left.mul(right);
        case '/': return left.div(right);
        case '^': {
          // GLSL pow(x, n) is undefined for negative x even for integer n.
          // Multiplication preserves real-valued x², x³, etc. across backends.
          if (ast.right.kind === 'number' &&
              Number.isInteger(ast.right.value) &&
              ast.right.value >= 0 && ast.right.value <= 4) {
            if (ast.right.value === 0) return float(1);
            let result = left;
            for (let index = 1; index < ast.right.value; index++) result = result.mul(left);
            return result;
          }
          return pow(left, right);
        }
        default: throw new Error('Unsupported operation');
      }
    }
    case 'call': {
      if (!Object.hasOwn(FUNCTIONS, ast.name)) throw new Error('Unknown function');
      return FUNCTIONS[ast.name](...ast.args.map((arg) => toTSL(arg, variables)));
    }
    default: throw new Error('Invalid expression node');
  }
}

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

    const parameterA = uniform(options.a);
    const parameterB = uniform(options.b);
    const time = uniform(0);
    const p = uv().sub(0.5).mul(2);
    const value = toTSL(options.expression, {
      x: p.x, y: p.y, t: time, a: parameterA, b: parameterB,
    });
    // A bounded color mapping. The formula defines the real scalar field.
    // Squaring retains the high-contrast interference aesthetic for signed waves.
    const intensity = clamp(value.mul(value), 0, 1);

    material = new MeshBasicNodeMaterial();
    material.colorNode = mix(
      vec3(0.025, 0.045, 0.09),
      vec3(1, 0.7, 0.37),
      intensity,
    );
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
      if (playing) time.value += dt * speed;
      renderer.render(scene, camera);
    });

    let disposed = false;
    return {
      setParameters(a, b) {
        parameterA.value = a;
        parameterB.value = b;
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
