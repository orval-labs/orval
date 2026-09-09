import { AsyncLocalStorage } from 'node:async_hooks';
import { styleText } from 'node:util';

import { isString } from './assertion';
import {
  ErrorWithTag,
  type LogLevel,
  type OrvalLogger,
  type OrvalReporter,
  type OrvalReportEvent,
} from '../types';

type ReportStore = {
  reporter: OrvalReporter;
  projectName?: string;
  /** True when a caller explicitly installed a reporter (including noop). */
  reporterSet: boolean;
};

export type ReportScope = {
  reporter?: OrvalReporter;
  projectName?: string;
  /** Keep an already-active reporter (used by `generate()`). */
  ifUnset?: boolean;
};

const storage = new AsyncLocalStorage<ReportStore>();

function writeConsole(event: OrvalReportEvent) {
  console.log(event.message);
}

export const noopReporter: OrvalReporter = {
  info() {},
  warn() {},
  error() {},
  verbose() {},
  debug() {},
};

export const consoleReporter: OrvalReporter = {
  info: writeConsole,
  warn: writeConsole,
  error: writeConsole,
  verbose: writeConsole,
  debug: writeConsole,
};

function run<T>(patch: ReportScope, callback: () => T): T {
  const current = storage.getStore();
  return storage.run(
    {
      reporter: patch.reporter ?? current?.reporter ?? noopReporter,
      projectName: patch.projectName ?? current?.projectName,
      reporterSet:
        patch.reporter !== undefined || current?.reporterSet === true,
    },
    callback,
  );
}

function toScope(value: OrvalReporter | ReportScope): ReportScope {
  const maybeReporter = value as OrvalReporter;
  const maybeScope = value as ReportScope;
  const hasInfo = typeof maybeReporter.info === 'function';
  const hasScopeField =
    maybeScope.reporter !== undefined ||
    maybeScope.ifUnset !== undefined ||
    Object.hasOwn(maybeScope, 'projectName');

  if (!hasInfo) {
    return maybeScope;
  }

  if (hasScopeField) {
    return {
      reporter: maybeScope.reporter ?? maybeReporter,
      projectName: maybeScope.projectName,
      ifUnset: maybeScope.ifUnset,
    };
  }

  return { reporter: maybeReporter };
}

/**
 * Run `callback` with a reporter. Unspecified fields inherit from the current
 * scope. Prefer {@link setProjectName} to set the project name.
 */
export function withReporter<T>(
  reporterOrScope: OrvalReporter | ReportScope,
  callback: () => T,
): T {
  const scope = toScope(reporterOrScope);

  if (scope.ifUnset && storage.getStore()?.reporterSet) {
    return callback();
  }

  return run(scope, callback);
}

/**
 * Set the ambient project name for subsequent log events. Creates a new
 * report store so earlier `bindReporter()` captures stay isolated.
 */
export function setProjectName(projectName?: string) {
  const current = storage.getStore();
  if (!current && projectName === undefined) {
    return;
  }

  storage.enterWith({
    reporter: current?.reporter ?? noopReporter,
    projectName,
    reporterSet: current?.reporterSet === true,
  });
}

export function getProjectName(): string | undefined {
  return storage.getStore()?.projectName;
}

/** Re-enter the current report scope from later callbacks (watchers). */
export function bindReporter() {
  const context = storage.getStore();
  return <T>(callback: () => T): T =>
    context ? storage.run(context, callback) : callback();
}

const LOG_LEVEL_RANK: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  verbose: 3,
  debug: 4,
};

let warningCount = 0;
let logLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel) {
  logLevel = level;
}

/** Map CLI flags to a {@link LogLevel}. `--quiet` keeps warnings visible. */
export function resolveLogLevel(options: {
  verbose?: boolean;
  quiet?: boolean;
  logLevel?: LogLevel;
}): LogLevel {
  if (options.verbose) {
    return 'verbose';
  }
  if (options.quiet) {
    return 'warn';
  }
  return options.logLevel ?? 'info';
}

export function getLogLevel(): LogLevel {
  return logLevel;
}

export function isLogLevelEnabled(level: LogLevel): boolean {
  return LOG_LEVEL_RANK[level] <= LOG_LEVEL_RANK[logLevel];
}

function prefixMessage(
  message: string,
  {
    projectName,
    packageName,
  }: { projectName?: string; packageName?: string } = {},
): string {
  return [
    projectName && styleText('green', projectName),
    packageName && `[${packageName}]`,
    message,
  ]
    .filter(Boolean)
    .join(' - ');
}

export function createLogger(packageName: string): OrvalLogger {
  const emit = (level: keyof OrvalReporter, message: string) => {
    const { reporter, projectName } = storage.getStore() ?? {
      reporter: noopReporter,
    };
    reporter[level]({
      message: prefixMessage(message, {
        projectName,
        packageName: isLogLevelEnabled('verbose') ? packageName : undefined,
      }),
      packageName,
      projectName,
    });
  };

  return {
    info(message) {
      if (isLogLevelEnabled('info')) emit('info', message);
    },
    warn(err, tag) {
      warningCount++;
      if (isLogLevelEnabled('warn')) {
        emit('warn', formatReportMessage('⚠️  ', 'yellow', err, tag));
      }
    },
    error(err, tag) {
      if (!isLogLevelEnabled('error')) return;
      if (err instanceof ErrorWithTag && tag === undefined) {
        emit(
          'error',
          formatReportMessage('🛑 ', 'red', err.cause ?? err, err.tag),
        );
        return;
      }
      emit('error', formatReportMessage('🛑 ', 'red', err, tag));
    },
    verbose(message) {
      if (isLogLevelEnabled('verbose')) emit('verbose', message);
    },
    debug(message) {
      if (isLogLevelEnabled('debug')) emit('debug', message);
    },
  };
}

export const logger = createLogger('@orval/core');

export const getWarningCount = () => warningCount;
export const resetWarnings = () => {
  warningCount = 0;
};

export function startMessage({
  name,
  version,
  description,
}: {
  name: string;
  version: string;
  description: string;
}): string {
  return `🍻 ${styleText(['cyan', 'bold'], name)} ${styleText('green', `v${version}`)}${
    description ? ` - ${description}` : ''
  }`;
}

export function createSuccessMessage(projectTitle?: string) {
  return `🎉 ${
    projectTitle ? `${styleText('green', projectTitle)} - ` : ''
  }Your OpenAPI spec has been converted into ready to use orval!`;
}

function formatReportMessage(
  marker: string,
  color: 'red' | 'yellow',
  err: unknown,
  tag?: string,
): string {
  const message = err instanceof Error ? formatError(err) : String(err);

  const body = [tag ? `${tag} -` : undefined, message]
    .filter(Boolean)
    .join(' ');

  return styleText(color, `${marker}${body}`);
}

function formatError(err: Error): string {
  const message = (err.message || err.stack) ?? 'Unknown error';
  if (!err.cause) return message;

  const cause =
    err.cause instanceof Error
      ? err.cause.message
      : isString(err.cause)
        ? err.cause
        : JSON.stringify(err.cause, undefined, 2);

  return `${message}\n  Cause: ${cause}`;
}
