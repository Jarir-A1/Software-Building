import { describe, expect, it } from 'vitest';
import { APP_NAME, APP_VERSION } from '../src/shared/constants';

// Baseline smoke test proving the test runner is wired to real source modules.
describe('shared constants', () => {
  it('exposes the application name exactly as WordSetu', () => {
    expect(APP_NAME).toBe('WordSetu');
  });

  it('exposes a semantic version string', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
