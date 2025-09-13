import { GlobalOptions, isString, logError, OptionsExport } from '@orval/core';

import { generateConfig, generateSpec } from './generate';
import { normalizeOptions } from './utils/options';
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
        } catch (error) {
          logError(error, options?.projectName);
        }
      },
      normalizedOptions.input.target as string,
    );
  } else {
    try {
      await generateSpec(workspace, normalizedOptions);
      return;
    } catch (error) {
      logError(error, options?.projectName);
    }
  }
};

export { generate };
export * from '@orval/core';

export default generate;

export { defineConfig } from './utils/options';
export { Options } from '@orval/core';
