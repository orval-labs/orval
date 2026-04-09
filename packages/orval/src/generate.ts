import {
  getWarningCount,
  type GlobalOptions,
  isString,
  logError,
  type OptionsExport,
  resetWarnings,
  setVerbose,
} from '@orval/core';

import { generateSpec } from './generate-spec';
import { findConfigFile, loadConfigFile } from './utils/config';
import { normalizeOptions } from './utils/options';
import { startWatcher } from './utils/watcher';

export async function generate(
  optionsExport?: string | OptionsExport,
  workspace = process.cwd(),
  options?: GlobalOptions,
) {
  setVerbose(!!options?.verbose);
  resetWarnings();

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

      try {
        await generateSpec(workspace, normalizedOptions, projectName);
      } catch (error) {
        hasErrors = true;
        logError(error, projectName);
      }

      if (options?.watch !== undefined) {
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

    if (options?.failOnWarnings && getWarningCount() > 0) {
      throw new Error(
        `Process failed with ${getWarningCount()} warning(s) due to failOnWarnings option`,
      );
    }

    return;
  }

  const normalizedOptions = await normalizeOptions(
    optionsExport,
    workspace,
    options,
  );

  try {
    await generateSpec(workspace, normalizedOptions);
  } catch (error) {
    logError(error);
  }

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
  }

  if (options?.failOnWarnings && getWarningCount() > 0) {
    throw new Error(
      `Process failed with ${getWarningCount()} warning(s) due to failOnWarnings option`,
    );
  }
}
