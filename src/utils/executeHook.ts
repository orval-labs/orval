import execa from 'execa';
import { Hook, NormalizedHookCommand } from '../types';
import { parseArgsStringToArgv } from 'string-argv';
import { log } from './messages/logs';
import chalk from 'chalk';
import { isFunction, isString } from './is';

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
