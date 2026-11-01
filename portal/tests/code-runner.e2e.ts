import { test, expect } from '@playwright/test';
import { runCode } from '../server/code-runner.js';
import { solution } from './fixtures.js';

test('isolated code runner passes correct code and fails wrong output, runtime errors and time limits', async () => {
  const correct = await runCode(solution.replace(/^#.*\n/gm, ''));
  expect(correct.status).toBe('Pass');
  expect(correct.cases).toBe(100);
  for (const source of ['print(0)', 'raise ValueError()', 'while True: pass']) {
    const result = await runCode(source);
    expect(result.status, result.detail).toBe('Fail');
    expect(result.cases).toBe(100);
  }
});
