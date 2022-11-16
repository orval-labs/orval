import {
  Hook,
  isFunction,
  isString,
  log,
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
        log(chalk.red(`🛑 Failed to run ${name} hook: ${e}`));
      }
    } else if (isFunction(command)) {
      await command(args);
    }
  }
};
