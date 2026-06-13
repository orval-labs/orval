import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createLogger,
  getWarningCount,
  logWarning,
  resetWarnings,
} from './logger';

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

describe('createLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deduplicates messages per logger instance', () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const firstLogger = createLogger('info');
    const secondLogger = createLogger('info');

    firstLogger.info('same message');
    secondLogger.info('same message');
    firstLogger.info('same message');

    expect(log).toHaveBeenCalledTimes(3);
    expect(log.mock.calls[0]).toEqual(['same message']);
    expect(log.mock.calls[1]).toEqual(['same message']);
    expect(log.mock.calls[2][0]).toBe('same message');
    expect(log.mock.calls[2][1]).toContain('(x2)');
  });
});
