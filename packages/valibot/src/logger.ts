import { createLogger } from '@orval/core';

export const logger = createLogger('@orval/valibot');

const warned = new Set<string>();

// Each distinct warning is logged once per process.
export const warnOnce = (message: string): void => {
  if (warned.has(message)) return;
  warned.add(message);
  logger.warn(message);
};
