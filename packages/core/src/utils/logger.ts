import chalk from 'chalk';
import readline from 'readline';
export const log = console.log; // tslint:disable-line:no-console

export const startMessage = ({
  name,
  version,
  description,
}: {
  name: string;
  version: string;
  description: string;
}) =>
  log(
    `🍻 Start ${chalk.cyan.bold(name)} ${chalk.green(`v${version}`)}${
      description ? ` - ${description}` : ''
    }`,
  );

export const logError = (err: unknown, tag?: string) =>
  log(
    chalk.red(
      [
        '🛑',
        tag ? `${tag} -` : undefined,
        err instanceof Error ? err.stack : err,
      ]
        .filter(Boolean)
        .join(' '),
    ),
  );

export const mismatchArgsMessage = (mismatchArgs: string[]) =>
  log(
    chalk.yellow(
      `${mismatchArgs.join(', ')} ${
        mismatchArgs.length === 1 ? 'is' : 'are'
      } not defined in your configuration!`,
    ),
  );

export const createSuccessMessage = (backend?: string) =>
  log(
    `🎉 ${
      backend ? `${chalk.green(backend)} - ` : ''
    }Your OpenAPI spec has been converted into ready to use orval!`,
  );

export const ibmOpenapiValidatorWarnings = (
  warnings: {
    path: string[];
    message: string;
  }[],
) => {
  log(chalk.yellow('(!) Warnings'));

  warnings.forEach((i) =>
    log(chalk.yellow(`Message : ${i.message}\nPath    : ${i.path.join(', ')}`)),
  );
};

export const ibmOpenapiValidatorErrors = (
  errors: {
    path: string[];
    message: string;
  }[],
) => {
  log(chalk.red('(!) Errors'));

  errors.forEach((i) =>
    log(chalk.red(`Message : ${i.message}\nPath    : ${i.path.join(', ')}`)),
  );
};

export type LogType = 'error' | 'warn' | 'info';
export type LogLevel = LogType | 'silent';
export interface Logger {
  info(msg: string, options?: LogOptions): void;
  warn(msg: string, options?: LogOptions): void;
  warnOnce(msg: string, options?: LogOptions): void;
  error(msg: string, options?: LogOptions): void;
  clearScreen(type: LogType): void;
  hasWarned: boolean;
}

export interface LogOptions {
  clear?: boolean;
  timestamp?: boolean;
}

export const LogLevels: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
};

let lastType: LogType | undefined;
let lastMsg: string | undefined;
let sameCount = 0;

function clearScreen() {
  const repeatCount = process.stdout.rows - 2;
  const blank = repeatCount > 0 ? '\n'.repeat(repeatCount) : '';
  console.log(blank);
  readline.cursorTo(process.stdout, 0, 0);
  readline.clearScreenDown(process.stdout);
}

export interface LoggerOptions {
  prefix?: string;
  allowClearScreen?: boolean;
}

export function createLogger(
  level: LogLevel = 'info',
  options: LoggerOptions = {},
): Logger {
  const { prefix = '[vite]', allowClearScreen = true } = options;

  const thresh = LogLevels[level];
  const clear =
    allowClearScreen && process.stdout.isTTY && !process.env.CI
      ? clearScreen
      : () => {};

  function output(type: LogType, msg: string, options: LogOptions = {}) {
    if (thresh >= LogLevels[type]) {
      const method = type === 'info' ? 'log' : type;
      const format = () => {
        if (options.timestamp) {
          const tag =
            type === 'info'
              ? chalk.cyan.bold(prefix)
              : type === 'warn'
                ? chalk.yellow.bold(prefix)
                : chalk.red.bold(prefix);
          return `${chalk.dim(new Date().toLocaleTimeString())} ${tag} ${msg}`;
        } else {
          return msg;
        }
      };
      if (type === lastType && msg === lastMsg) {
        sameCount++;
        clear();
        console[method](format(), chalk.yellow(`(x${sameCount + 1})`));
      } else {
        sameCount = 0;
        lastMsg = msg;
        lastType = type;
        if (options.clear) {
          clear();
        }
        console[method](format());
      }
    }
  }

  const warnedMessages = new Set<string>();

  const logger: Logger = {
    hasWarned: false,
    info(msg, opts) {
      output('info', msg, opts);
    },
    warn(msg, opts) {
      logger.hasWarned = true;
      output('warn', msg, opts);
    },
    warnOnce(msg, opts) {
      if (warnedMessages.has(msg)) return;
      logger.hasWarned = true;
      output('warn', msg, opts);
      warnedMessages.add(msg);
    },
    error(msg, opts) {
      logger.hasWarned = true;
      output('error', msg, opts);
    },
    clearScreen(type) {
      if (thresh >= LogLevels[type]) {
        clear();
      }
    },
  };

  return logger;
}
