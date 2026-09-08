import { styleText } from 'node:util';

import { isString } from './assertion';

export const log = console.log;

let _warningCount = 0;

export function logWarning(message: string) {
  _warningCount++;
  log(styleText('yellow', message));
}

export function getWarningCount(): number {
  return _warningCount;
}

export function resetWarnings(): void {
  _warningCount = 0;
}

let _verbose = false;

export function setVerbose(v: boolean) {
  _verbose = v;
}

let _quiet = false;

export function setQuiet(v: boolean) {
  _quiet = v;
}

export function isQuiet(): boolean {
  return _quiet;
}

export const logVerbose: typeof console.log = (...args) => {
  if (_verbose) log(...args);
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

export function logError(err: unknown, tag?: string) {
  let message;

  if (err instanceof Error) {
    message = (err.message || err.stack) ?? 'Unknown error';
    if (err.cause) {
      const causeMsg =
        err.cause instanceof Error
          ? err.cause.message
          : isString(err.cause)
            ? err.cause
            : JSON.stringify(err.cause, undefined, 2);
      message += `\n  Cause: ${causeMsg}`;
    }
  } else {
    message = String(err);
  }

  log(
    styleText(
      'red',
      ['🛑', tag ? `${tag} -` : undefined, message].filter(Boolean).join(' '),
    ),
  );
}

export function createSuccessMessage(backend?: string) {
  if (isQuiet()) {
    return;
  }
  log(
    `🎉 ${
      backend ? `${styleText('green', backend)} - ` : ''
    }Your OpenAPI spec has been converted into ready to use orval!`,
  );
}
