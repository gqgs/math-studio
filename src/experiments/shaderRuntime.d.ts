export type ShaderHandle = {
  setParameters(frequency: number, curvature: number): void;
  dispose(): void;
};

export type ShaderOptions = {
  frequency: number;
  curvature: number;
  backend: 'auto' | 'webgl';
  signal: AbortSignal;
  onStatus: (status: string) => void;
  getPlayback: () => { playing: boolean; speed: number };
};

export function mountShader(
  host: HTMLElement,
  options: ShaderOptions,
): Promise<ShaderHandle | null>;
