import {
  GlobalOptions,
  isString,
  log,
  Options,
  OptionsExport,
} from '@orval/core';
import chalk from 'chalk';
import { generateConfig, generateSpec } from './generate';
import { defineConfig, normalizeOptions } from './utils/options';
import { startWatcher } from './utils/watcher';

const generate = async (
  optionsExport?: string | OptionsExport,
  workspace = process.cwd(),
  options?: GlobalOptions,
) => {
  if (!optionsExport || isString(optionsExport)) {
    return generateConfig(optionsExport, options);
  }

  const normalizedOptions = await normalizeOptions(
    optionsExport,
    workspace,
    options,
  );

  if (options?.watch) {
    startWatcher(
      options?.watch,
      async () => {
        try {
          await generateSpec(workspace, normalizedOptions);
        } catch (e) {
          log(
            chalk.red(
              `🛑  ${
                options?.projectName ? `${options?.projectName} - ` : ''
              }${e}`,
            ),
          );
        }
      },
      normalizedOptions.input.target as string,
    );
  } else {
    try {
      return await generateSpec(workspace, normalizedOptions);
    } catch (e) {
      log(
        chalk.red(
          `🛑  ${options?.projectName ? `${options?.projectName} - ` : ''}${e}`,
        ),
      );
    }
  }
};

export { defineConfig };
export { Options };
export { generate };

export default generate;
