import {
  type GlobalOptions,
  isString,
  logError,
  type OptionsExport,
  setVerbose,
} from '@orval/core';

import { generateSpec } from './generate-spec.ts';
import { findConfigFile, loadConfigFile } from './utils/config.ts';
import { normalizeOptions } from './utils/options.ts';
import { startWatcher } from './utils/watcher.ts';

export async function generate(
  optionsExport?: string | OptionsExport,
  workspace = process.cwd(),
  options?: GlobalOptions,
) {
  setVerbose(!!options?.verbose);

  if (!optionsExport || isString(optionsExport)) {
    const configFilePath = findConfigFile(optionsExport);
    const configFile = await loadConfigFile(configFilePath);

    const configs = Object.entries(configFile);

    let hasErrors = false;
    for (const [projectName, config] of configs) {
      const normalizedOptions = await normalizeOptions(
        config,
        workspace,
        options,
      );

      if (options?.watch === undefined) {
        try {
          await generateSpec(workspace, normalizedOptions, projectName);
        } catch (error) {
          hasErrors = true;
          logError(error, projectName);
        }
      } else {
        const fileToWatch = isString(normalizedOptions.input.target)
          ? normalizedOptions.input.target
          : undefined;

        await startWatcher(
          options.watch,
          async () => {
            try {
              await generateSpec(workspace, normalizedOptions, projectName);
            } catch (error) {
              logError(error, projectName);
            }
          },
          fileToWatch,
        );
      }
    }

    if (hasErrors)
      logError('One or more project failed, see above for details');

    return;
  }

  const normalizedOptions = await normalizeOptions(
    optionsExport,
    workspace,
    options,
  );

  if (options?.watch) {
    await startWatcher(
      options.watch,
      async () => {
        try {
          await generateSpec(workspace, normalizedOptions);
        } catch (error) {
          logError(error);
        }
      },
      normalizedOptions.input.target as string,
    );
  } else {
    try {
      await generateSpec(workspace, normalizedOptions);
    } catch (error) {
      logError(error);
    }
  }
}
