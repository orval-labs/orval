import type { OrvalLogger } from '../types';
import type { SchemaWalkReporter } from './dereference';

/** A reporter that shows each warning once per run, however often it recurs. */
export const createWarnOnceReporter = (
  library: string,
  logger: Pick<OrvalLogger, 'warn' | 'verbose'>,
) => {
  const warned = new Set<string>();
  let currentRun: object | undefined;
  const warnOnce = (message: string): void => {
    if (warned.has(message)) return;
    warned.add(message);
    logger.warn(message);
  };
  const reporter: SchemaWalkReporter = {
    library,
    warn: warnOnce,
    verbose: (message) => logger.verbose(message),
  };
  const resetWarnings = (): void => warned.clear();
  return {
    reporter,
    warnOnce,
    resetWarnings,
    // A new document starts a new set of warnings (each project, each rerun).
    startRun: (run: object): void => {
      if (run === currentRun) return;
      currentRun = run;
      resetWarnings();
    },
  };
};
