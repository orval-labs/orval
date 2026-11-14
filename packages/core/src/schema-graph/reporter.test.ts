import { describe, expect, it, vi } from 'vite-plus/test';

import { createWarnOnceReporter } from './reporter';

const setup = () => {
  const logger = { warn: vi.fn(), verbose: vi.fn() };
  return { logger, ...createWarnOnceReporter('effect', logger) };
};

describe('createWarnOnceReporter', () => {
  it('names the library and forwards verbose messages', () => {
    const { logger, reporter } = setup();
    reporter.verbose('seen');
    expect(reporter.library).toBe('effect');
    expect(logger.verbose).toHaveBeenCalledWith('seen');
  });

  it('shows a warning once per run', () => {
    const { logger, reporter, startRun } = setup();
    const run = {};
    startRun(run);
    reporter.warn('x');
    reporter.warn('x');
    startRun(run);
    reporter.warn('x');
    expect(logger.warn).toHaveBeenCalledTimes(1);
    startRun({});
    reporter.warn('x');
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it('shows a warning again after a reset', () => {
    const { logger, warnOnce, resetWarnings } = setup();
    warnOnce('x');
    resetWarnings();
    warnOnce('x');
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });
});
