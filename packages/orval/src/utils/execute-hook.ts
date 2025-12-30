import {
  type Hook,
  type HookOption,
  isFunction,
  isObject,
  isString,
  log,
  logError,
  type NormalizedHookCommand,
} from '@orval/core';
import chalk from 'chalk';
import { execa } from 'execa';
import { parseArgsStringToArgv } from 'string-argv';

export const executeHook = async (
  name: Hook,
  commands: NormalizedHookCommand = [],
  args: string[] = [],
) => {
  log(chalk.white(`Running ${name} hook...`));

  for (const command of commands) {
    try {
      if (isString(command)) {
        await executeCommand(command, args);
      } else if (isFunction(command)) {
        await command(args);
      } else if (isObject(command)) {
        await executeObjectCommand(command as HookOption, args);
      }
    } catch (error) {
      logError(error, `Failed to run ${name} hook`);
    }
  }
};

async function executeCommand(command: string, args: string[]) {
  const [cmd, ..._args] = [...parseArgsStringToArgv(command), ...args];

  await execa(cmd, _args);
}

async function executeObjectCommand(command: HookOption, args: string[]) {
  if (command.injectGeneratedDirsAndFiles === false) {
    args = [];
  }

  if (isString(command.command)) {
    await executeCommand(command.command, args);
  } else if (isFunction(command.command)) {
    await command.command();
  }
}
