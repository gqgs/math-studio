export type Parameter = {
  id: 'a' | 'b' | 'speed';
  label: string;
  min: number;
  max: number;
  step: number;
  initial: number;
  description: string;
};

// Expressions describe scalar values, not arbitrary JavaScript or shader code.
// Two uniforms (a, b) plus time t can be reused for different expressions.
export const PARAMETERS: readonly Parameter[] = [
  { id: 'a', label: 'Parameter a', min: 0, max: 30, step: 0.1, initial: 14,
    description: 'Available as a in the formula' },
  { id: 'b', label: 'Parameter b', min: 0, max: 8, step: 0.01, initial: 1.1,
    description: 'Available as b in the formula' },
  { id: 'speed', label: 'Time speed', min: 0, max: 3, step: 0.05, initial: 0.5,
    description: 'Controls the rate of t when playback is active' },
];

export const PRESETS = [
  {
    name: 'Interference',
    formula: '(sin(a*x + 7*b*y^2 + t) + sin(0.75*a*y - 9*b*x^2 - 0.8*t) + sin(0.45*a*(x+y) + 0.35*t))/3',
    values: { a: 14, b: 1.1, speed: 0.5 },
  },
  {
    name: 'Radial ripples',
    formula: 'sin(a*sqrt(x^2 + y^2) - t)',
    values: { a: 22, b: 1.1, speed: 1.2 },
  },
  {
    name: 'Moiré',
    formula: 'sin(a*x+t)*sin(a*(x*cos(b)+y*sin(b))-t)',
    values: { a: 18, b: 0.33, speed: 0.6 },
  },
  {
    name: 'Saddle',
    formula: 'sin(a*(x^2-y^2)+t)*cos(b*8*x*y)',
    values: { a: 12, b: 1.1, speed: 0.4 },
  },
] as const;

export function initialParameters(): Record<Parameter['id'], number> {
  return { a: 14, b: 1.1, speed: 0.5 };
}

export function clampParameter(parameter: Parameter, input: number): number {
  return Number.isFinite(input) ? Math.min(parameter.max, Math.max(parameter.min, input)) : parameter.initial;
}
