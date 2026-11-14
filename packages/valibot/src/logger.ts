import { createLogger, createWarnOnceReporter } from '@orval/core';

export const logger = createLogger('@orval/valibot');

export const { reporter, resetWarnings, startRun, warnOnce } =
  createWarnOnceReporter('valibot', logger);
