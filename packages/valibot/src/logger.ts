import { createLogger } from '@orval/core';

export const logger = createLogger('@orval/valibot');

const warned = new Set<string>();

export const resetWarnings = (): void => {
  warned.clear();
};

let currentRun: object | undefined;

// A run works on its own parsed document, so a new document starts a new set
// of warnings. This is the case for each project and each watch rerun.
export const startRun = (run: object): void => {
  if (run === currentRun) return;
  currentRun = run;
  resetWarnings();
};

// Each distinct warning is logged once per generation run.
export const warnOnce = (message: string): void => {
  if (warned.has(message)) return;
  warned.add(message);
  logger.warn(message);
};
