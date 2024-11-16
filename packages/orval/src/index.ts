import {
  GlobalOptions,
  isString,
  logError,
  Options,
  OptionsExport,
} from '@orval/core';
import { generateConfig, generateSpec } from './generate';
import { defineConfig, normalizeOptions } from './utils/options';
import { startWatcher } from './utils/watcher';
import { writeLastCommit } from './utils/write-last-commit';

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
          await writeLastCommit(workspace);
        } catch (e) {
          logError(e, options?.projectName);
        }
      },
      normalizedOptions.input.target as string,
    );
  } else {
    try {
      await generateSpec(workspace, normalizedOptions);
      await writeLastCommit(workspace);
    } catch (e) {
      logError(e, options?.projectName);
    }
  }
};

export { defineConfig };
export { Options };
export { generate };

export default generate;
