import debug from 'debug';

const filter = process.env.ORVAL_DEBUG_FILTER;
const DEBUG = process.env.DEBUG;

interface DebuggerOptions {
  onlyWhenFocused?: boolean | string;
}

export function createDebugger(
  ns: string,
  options: DebuggerOptions = {},
): debug.Debugger['log'] {
  const log = debug(ns);
  const { onlyWhenFocused } = options;
  const focus = typeof onlyWhenFocused === 'string' ? onlyWhenFocused : ns;
  return (msg: string, ...args: any[]) => {
    if (filter && !msg.includes(filter)) {
      return;
    }
    if (onlyWhenFocused && !DEBUG?.includes(focus)) {
      return;
    }
    log(msg, ...args);
  };
}
