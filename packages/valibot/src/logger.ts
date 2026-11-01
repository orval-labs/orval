import { createLogger } from '@orval/core';

export const logger = createLogger('@orval/valibot');

const warned = new Set<string>();

export const resetWarnings = (): void => {
  warned.clear();
};

let currentRun: object | undefined;

// A new document starts a new set of warnings (each project, each watch rerun).
export const startRun = (run: object): void => {
  if (run === currentRun) return;
  currentRun = run;
  resetWarnings();
};

export const warnOnce = (message: string): void => {
  if (warned.has(message)) return;
  warned.add(message);
  logger.warn(message);
};
