export interface RenderRequest {
  type: 'render';
  revision: number;
  blockId: number;
  source: string;
}
export interface CompilerDiagnostic {
  message: string;
  range: string;
}
export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'fatal'; message: string }
  | {
      type: 'result';
      revision: number;
      blockId: number;
      source: string;
      svg?: string;
      diagnostics: CompilerDiagnostic[];
    };
