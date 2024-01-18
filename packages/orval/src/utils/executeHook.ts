import {
  Hook,
  isFunction,
  isString,
  log,
  logError,
  NormalizedHookCommand,
} from '@orval/core';
import chalk from 'chalk';
import execa from 'execa';
import { parseArgsStringToArgv } from 'string-argv';

export const executeHook = async (
  name: Hook,
  commands: NormalizedHookCommand = [],
  args: string[] = [],
) => {
  log(chalk.white(`Running ${name} hook...`));

  for (const command of commands) {
    if (isString(command)) {
      const [cmd, ..._args] = [...parseArgsStringToArgv(command), ...args];

      try {
        await execa(cmd, _args);
      } catch (e) {
        logError(e, `Failed to run ${name} hook`);
      }
    } else if (isFunction(command)) {
      await command(args);
    }
  }
};
