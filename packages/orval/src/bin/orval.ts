#!/usr/bin/env node
import path from 'node:path';

import { Option, program } from '@commander-js/extra-typings';
import {
  ErrorWithTag,
  isString,
  log,
  logError,
  OutputClient,
  OutputMode,
  startMessage,
} from '@orval/core';

import pkg from '../../package.json';
import { generateSpec } from '../generate-spec';
import { findConfigFile, loadConfigFile } from '../utils/config';
import { normalizeOptions } from '../utils/options';
import { startWatcher } from '../utils/watcher';

const orvalMessage = startMessage({
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
});
const cli = program
  .name('orval')
  .description(
    'Instantly generate TypeScript clients from your OpenAPI specification',
  )
  .version(pkg.version);

cli
  .addOption(
    new Option('-o, --output <path>', 'output file destination').conflicts([
      'config',
      'project',
    ]),
  )
  .addOption(
    new Option(
      '-i, --input <path>',
      'input file (yaml or json openapi specs)',
    ).conflicts(['config', 'project']),
  )
  .addOption(
    new Option(
      '-c, --config <path>',
      'override flags by a config file',
    ).conflicts(['input', 'output']),
  )
  .addOption(
    new Option(
      '-p, --project <name...>',
      'focus one or more projects of the config',
    ).conflicts(['input', 'output']),
  )
  .addOption(
    new Option('-m, --mode <name>', 'default mode that will be used').choices(
      Object.values(OutputMode),
    ),
  )
  .option(
    '-w, --watch [paths...]',
    'Watch mode, if path is not specified, it watches the input target',
  )
  .addOption(
    new Option('--client <name>', 'default client that will be used').choices(
      Object.values(OutputClient),
    ),
  )
  .option('--mock', 'activate the mock')
  .option('--clean [paths...]', 'Clean output directory')
  .option('--prettier', 'Prettier generated files')
  .option('--biome', 'biome generated files')
  .option('--tsconfig <path>', 'path to your tsconfig file')
  .action(async (options) => {
    log(orvalMessage);

    if (isString(options.input) && isString(options.output)) {
      const normalizedOptions = await normalizeOptions({
        input: options.input,
        output: {
          target: options.output,
          clean: options.clean,
          prettier: options.prettier,
          biome: options.biome,
          mock: options.mock,
          client: options.client,
          mode: options.mode,
          tsconfig: options.tsconfig,
        },
      });

      if (options.watch) {
        await startWatcher(
          options.watch,
          async () => {
            try {
              await generateSpec(process.cwd(), normalizedOptions);
            } catch (error) {
              logError(error);
              process.exit(1);
            }
          },
          normalizedOptions.input.target as string,
        );
      } else {
        try {
          await generateSpec(process.cwd(), normalizedOptions);
        } catch (error) {
          if (error instanceof ErrorWithTag) {
            logError(error.cause, error.tag);
          } else {
            logError(error);
          }
          process.exit(1);
        }
      }
    } else {
      const configFilePath = findConfigFile(options.config);
      const workspace = path.dirname(configFilePath);
      const configFile = await loadConfigFile(configFilePath);

      const missingProjects = options.project?.filter(
        (p) => !Object.hasOwn(configFile, p),
      );

      if (missingProjects?.length) {
        logError(`Project not found in config: ${missingProjects.join(', ')}`);
        process.exit(1);
      }

      const configs = Object.entries(configFile).filter(
        ([projectName]) =>
          // only filter by project if specified
          !Array.isArray(options.project) ||
          options.project.includes(projectName),
      );

      let hasErrors = false;
      for (const [projectName, config] of configs) {
        const normalizedOptions = await normalizeOptions(
          config,
          workspace,
          options,
        );

        if (options.watch === undefined) {
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

      if (hasErrors) {
        logError('One or more project failed, see above for details');
        process.exit(1);
      }
    }
  });

await cli.parseAsync(process.argv);
