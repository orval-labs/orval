import type { OrvalLogger, UnsupportedSchemaMode } from '../types';
import type { SchemaWalkReporter } from './dereference';

/** The error that stops a generation in `unsupported: 'error'` mode. */
export const unsupportedError = (
  library: string,
  message: string,
  path?: string,
  hint?: string,
): Error =>
  new Error(
    `[orval/${library}] ${message}${path ? ` At ${path}.` : ''}${hint ? ` ${hint}` : ''} Set \`override.${library}.unsupported\` to 'warn' to generate it anyway.`,
  );

/**
 * A reporter that shows each warning once per run, however often it recurs.
 * In `error` mode (see `setUnsupportedMode`) a warning throws instead.
 */
export const createWarnOnceReporter = (
  library: string,
  logger: Pick<OrvalLogger, 'warn' | 'verbose'>,
) => {
  const warned = new Set<string>();
  let currentRun: object | undefined;
  let mode: UnsupportedSchemaMode = 'warn';
  const warnOnce = (message: string, path?: string, hint?: string): void => {
    if (mode === 'error') throw unsupportedError(library, message, path, hint);
    if (warned.has(message)) return;
    warned.add(message);
    logger.warn(message);
  };
  // A warning that never fails the generation, such as a dropped default:
  // it does not loosen validation.
  const noticeOnce = (message: string): void => {
    if (warned.has(message)) return;
    warned.add(message);
    logger.warn(message);
  };
  const reporter: SchemaWalkReporter = {
    library,
    warn: warnOnce,
    verbose: (message) => logger.verbose(message),
    mode: () => mode,
  };
  const resetWarnings = (): void => warned.clear();
  return {
    reporter,
    warnOnce,
    noticeOnce,
    resetWarnings,
    setUnsupportedMode: (next: UnsupportedSchemaMode): void => {
      mode = next;
    },
    unsupportedMode: (): UnsupportedSchemaMode => mode,
    // A new document starts a new set of warnings (each project, each rerun).
    startRun: (run: object): void => {
      if (run === currentRun) return;
      currentRun = run;
      resetWarnings();
    },
  };
};
