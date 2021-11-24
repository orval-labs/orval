import chalk from 'chalk';
import { generateConfig, generateSpec } from './generate';
import { Options, OptionsExport } from './types';
import { isString } from './utils/is';
import { log } from './utils/messages/logs';
import { defineConfig, normalizeOptions } from './utils/options';
import { startWatcher } from './utils/watcher';

const generate = async (
  optionsExport?: string | OptionsExport,
  workspace = process.cwd(),
  options?: {
    projectName?: string;
    watch?: boolean | string | (string | boolean)[];
    clean?: boolean | string[];
    prettier?: boolean;
    eslint?: boolean;
  },
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

export * from './types/generator';
export { defineConfig };
export { Options };
export { generate };

export default generate;
