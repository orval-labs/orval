import path from 'node:path';

import {
  collectOutdatedGeneratedFiles,
  consoleReporter,
  createGeneratedFileCheck,
  getWarningCount,
  type GlobalOptions,
  isString,
  type OptionsExport,
  resetWarnings,
  setLogLevel,
  setProjectName,
  withGeneratedFileCheck,
  withReporter,
} from '@orval/core';

import { generateSpec } from './generate-spec';
import { logger } from './logger';
import {
  findConfigFile,
  getConfigProjects,
  loadConfigFile,
} from './utils/config';
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
  const check = options?.outdated ? createGeneratedFileCheck() : undefined;
  const run = () => generateProjects(optionsExport, workspace, options);
  const hasErrors = await (check ? withGeneratedFileCheck(check, run) : run());

  if (check) {
    // A failed project collected nothing, so an empty result proves nothing.
    if (hasErrors) {
      throw new Error(
        'Cannot check for outdated files: one or more projects failed, see above for details',
      );
    }
    const outdated = await collectOutdatedGeneratedFiles(check);
    if (outdated.length > 0) {
      for (const file of outdated) {
        logger.error(`${file.status}: ${path.relative(workspace, file.path)}`);
      }
      throw new Error(
        `Process failed with ${outdated.length} outdated generated file(s) due to outdated option`,
      );
    }
    logger.info('All generated files are up to date');
  }

  if (options?.failOnWarnings && getWarningCount() > 0) {
    throw new Error(
      `Process failed with ${getWarningCount()} warning(s) due to failOnWarnings option`,
    );
  }
}

/** Resolves to whether any project failed. */
async function generateProjects(
  optionsExport: string | OptionsExport | undefined,
  workspace: string,
  options?: GlobalOptions,
): Promise<boolean> {
  resetWarnings();

  if (!optionsExport || isString(optionsExport)) {
    const configFilePath = findConfigFile(optionsExport);
    const configFile = await loadConfigFile(configFilePath);

    setLogLevel(options?.logLevel ?? configFile.logLevel ?? 'info');

    const configs = getConfigProjects(configFile);

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

    return hasErrors;
  }

  setLogLevel(options?.logLevel ?? 'info');

  const normalizedOptions = await normalizeOptions(
    optionsExport,
    workspace,
    options,
  );

  let hasErrors = false;
  try {
    await generateSpec(workspace, normalizedOptions);
  } catch (error) {
    logger.error(error);
    if (options?.throwOnError) {
      throw error;
    }
    hasErrors = true;
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

  return hasErrors;
}
