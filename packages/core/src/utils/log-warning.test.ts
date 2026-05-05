import { afterEach, describe, expect, it, vi } from 'vitest';

import { getWarningCount, logWarning, resetWarnings } from './logger';

describe('logWarning', () => {
  afterEach(() => {
    resetWarnings();
    vi.restoreAllMocks();
  });

  it('should increment the warning count', () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    vi.spyOn(console, 'log').mockImplementation(() => {});

    expect(getWarningCount()).toBe(0);
    logWarning('test warning');
    expect(getWarningCount()).toBe(1);
    logWarning('another warning');
    expect(getWarningCount()).toBe(2);
  });

  it('should reset the warning count', () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    vi.spyOn(console, 'log').mockImplementation(() => {});

    logWarning('test warning');
    expect(getWarningCount()).toBe(1);
    resetWarnings();
    expect(getWarningCount()).toBe(0);
  });
});
