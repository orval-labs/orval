import {
  consoleReporter,
  getWarningCount,
  type GlobalOptions,
  isString,
  type OptionsExport,
  resetWarnings,
  setLogLevel,
  setProjectName,
  withReporter,
} from '@orval/core';

import { generateSpec } from './generate-spec';
import { logger } from './logger';
import { findConfigFile, loadConfigFile } from './utils/config';
import { normalizeOptions } from './utils/options';
import { startWatcher } from './utils/watcher';

export async function generate(
  optionsExport?: string | OptionsExport,
  workspace = process.cwd(),
  options?: GlobalOptions,
) {
  return withReporter({ reporter: consoleReporter, ifUnset: true }, () =>
    generateWithReporter(optionsExport, workspace, options),
  );
}

async function generateWithReporter(
  optionsExport: string | OptionsExport | undefined,
  workspace: string,
  options?: GlobalOptions,
) {
  setLogLevel(options?.logLevel ?? 'info');
  resetWarnings();

  if (!optionsExport || isString(optionsExport)) {
    const configFilePath = findConfigFile(optionsExport);
    const configFile = await loadConfigFile(configFilePath);

    const configs = Object.entries(configFile);

    let hasErrors = false;
    for (const [projectName, config] of configs) {
      setProjectName(projectName);
      const normalizedOptions = await normalizeOptions(
        config,
        workspace,
        options,
      );

      try {
        await generateSpec(workspace, normalizedOptions, projectName);
      } catch (error) {
        logger.error(error);
        if (options?.throwOnError) {
          throw error;
        }
        hasErrors = true;
      }

      if (options?.watch !== undefined) {
        const fileToWatch = isString(normalizedOptions.input.target)
          ? normalizedOptions.input.target
          : undefined;

        await startWatcher(
          options.watch,
          async () => {
            resetWarnings();
            try {
              await generateSpec(workspace, normalizedOptions, projectName);
            } catch (error) {
              logger.error(error);
            }
            if (options.failOnWarnings && getWarningCount() > 0) {
              throw new Error(
                `Process failed with ${getWarningCount()} warning(s) due to failOnWarnings option`,
              );
            }
          },
          fileToWatch,
        );
      }
    }

    setProjectName();

    if (hasErrors)
      logger.error('One or more project failed, see above for details');

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
    logger.error(error);
    if (options?.throwOnError) {
      throw error;
    }
  }

  if (options?.watch) {
    await startWatcher(
      options.watch,
      async () => {
        resetWarnings();
        try {
          await generateSpec(workspace, normalizedOptions);
        } catch (error) {
          logger.error(error);
        }
        if (options.failOnWarnings && getWarningCount() > 0) {
          throw new Error(
            `Process failed with ${getWarningCount()} warning(s) due to failOnWarnings option`,
          );
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
