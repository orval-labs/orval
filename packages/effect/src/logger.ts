import { createLogger, createWarnOnceReporter } from '@orval/core';

export const logger = createLogger('@orval/effect');

export const { reporter, startRun, warnOnce } = createWarnOnceReporter(
  'effect',
  logger,
);
