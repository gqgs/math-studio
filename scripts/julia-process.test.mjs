import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explainJuliaFailure } from './julia-process.mjs';

test('reports Julia termination signals, rather than silently exiting', () => {
  const message = explainJuliaFailure({ status: null, signal: 'SIGSEGV', error: undefined });
  assert.match(message, /SIGSEGV/);
  assert.match(message, /native Julia crash/);
});

test('reports nonzero Julia exits including exit 139', () => {
  assert.match(explainJuliaFailure({ status: 1, signal: null }), /status 1/);
  assert.match(explainJuliaFailure({ status: 139, signal: null }), /SIGSEGV/);
});

test('reports missing executable and suggests JULIA_BIN', () => {
  const message = explainJuliaFailure({ error: { code: 'ENOENT', message: 'spawn julia ENOENT' } });
  assert.match(message, /not found/);
  assert.match(message, /JULIA_BIN/);
});

test('does not report successful subprocess execution as failure', () => {
  assert.equal(explainJuliaFailure({ status: 0, signal: null }), null);
});
