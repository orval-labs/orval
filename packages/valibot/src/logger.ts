import {
  type ContextSpec,
  createLogger,
  createWarnOnceReporter,
} from '@orval/core';

export const logger = createLogger('@orval/valibot');

export const {
  noticeOnce,
  reporter,
  resetWarnings,
  setUnsupportedMode,
  startRun,
  unsupportedMode,
  unsupportedOnly,
  warnOnce,
} = createWarnOnceReporter('valibot', logger);

/** Takes the `unsupported` mode from the output being generated. */
export const useUnsupportedModeOf = (context: ContextSpec): void => {
  setUnsupportedMode(context.output.override.valibot.unsupported);
};
