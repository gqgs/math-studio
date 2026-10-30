import type { ExpressionNode } from './expression';

export type ShaderHandle = {
  setParameters(a: number, b: number): void;
  dispose(): void;
};

export type ShaderOptions = {
  expression: ExpressionNode;
  a: number;
  b: number;
  backend: 'auto' | 'webgl';
  signal: AbortSignal;
  onStatus: (status: string) => void;
  getPlayback: () => { playing: boolean; speed: number };
};

export function mountShader(
  host: HTMLElement,
  options: ShaderOptions,
): Promise<ShaderHandle | null>;
