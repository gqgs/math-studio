export type Parameter = {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  initial: number;
  description: string;
};

export type Experiment = {
  id: 'interference' | 'painleve';
  name: string;
  subtitle: string;
  equation: string;
  type: 'shader' | 'numerical';
  parameters: readonly Parameter[];
  presets: readonly { name: string; values: Record<string, number> }[];
};

export const EXPERIMENTS: readonly Experiment[] = [
  {
    id: 'interference',
    name: 'Interference field',
    subtitle: 'A live, GPU-evaluated field of coupled oscillations.',
    equation: 'I(x,y,t) = [sin(ax + by² + t) + sin(cy - dx² - t)]² / 4',
    type: 'shader',
    parameters: [
      { id: 'frequency', label: 'Frequency', min: 2, max: 30, step: 0.1, initial: 14, description: 'Number of oscillations across the field' },
      { id: 'curvature', label: 'Curvature', min: 0, max: 2.5, step: 0.01, initial: 1.1, description: 'Bending of the interference bands' },
      { id: 'speed', label: 'Speed', min: 0, max: 3, step: 0.05, initial: 0.5, description: 'Rate of phase evolution' },
    ],
    presets: [
      { name: 'Default', values: { frequency: 14, curvature: 1.1, speed: 0.5 } },
      { name: 'Fine fringes', values: { frequency: 25, curvature: 0.65, speed: 0.35 } },
      { name: 'Slow folds', values: { frequency: 8, curvature: 2.1, speed: 0.2 } },
    ],
  },
  {
    id: 'painleve',
    name: 'Painlevé I',
    subtitle: 'Sensitive solution families of a nonlinear second-order ODE.',
    equation: "w'' = 6w² + x,    w(0) = 0,    w'(0) = k",
    type: 'numerical',
    parameters: [
      { id: 'k', label: 'Initial slope k', min: -0.6, max: 2.1, step: 0.000001, initial: 1.851853, description: "Value of w'(0)" },
      { id: 'delta', label: 'Comparison Δk', min: 0, max: 0.03, step: 0.000001, initial: 0.000002, description: 'Offset between the two initial slopes' },
    ],
    presets: [
      { name: 'Critical +', values: { k: 1.851853, delta: 0.000002 } },
      { name: 'Critical −', values: { k: -0.451428, delta: 0.000001 } },
      { name: 'Ordinary', values: { k: 0.75, delta: 0.1 } },
    ],
  },
] as const;

export function initialParameters(experiment: Experiment): Record<string, number> {
  return Object.fromEntries(experiment.parameters.map((parameter) => [parameter.id, parameter.initial]));
}

export function clampParameter(parameter: Parameter, input: number): number {
  return Number.isFinite(input) ? Math.min(parameter.max, Math.max(parameter.min, input)) : parameter.initial;
}
