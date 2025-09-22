#!/usr/bin/env node
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
import { generateConfig, generateSpec } from '../generate';
import { normalizeOptions } from '../utils/options';
import { startWatcher } from '../utils/watcher';

const orvalMessage = startMessage({
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
});
const cli = program
  .name('orval')
  .description(orvalMessage)
  .version(pkg.version);

cli
  .option('-o, --output <path>', 'output file destination')
  .option('-i, --input <path>', 'input file (yaml or json openapi specs)')
  .option('-c, --config <path>', 'override flags by a config file')
  .option('-p, --project <name>', 'focus a project of the config')
  .addOption(
    new Option('-m, --mode <name>', 'default mode that will be used').choices(
      Object.values(OutputMode),
    ),
  )
  .option(
    '-w, --watch [path]',
    'Watch mode, if path is not specified, it watches the input target',
  )
  .addOption(
    new Option('--client <name>', 'default client that will be used').choices(
      Object.values(OutputClient),
    ),
  )
  .option('--mock', 'activate the mock')
  .option('--clean [path...]', 'Clean output directory')
  .option('--prettier', 'Prettier generated files')
  .option('--biome', 'biome generated files')
  .option('--tsconfig <path>', 'path to your tsconfig file')
  .action(async (options) => {
    log(orvalMessage);
    if (
      !options.config &&
      isString(options.input) &&
      isString(options.output)
    ) {
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
      await generateConfig(options.config, {
        projectName: options.project,
        watch: options.watch,
        clean: options.clean,
        prettier: options.prettier,
        biome: options.biome,
        mock: options.mock,
        client: options.client,
        mode: options.mode,
        tsconfig: options.tsconfig,
        input: options.input,
        output: options.output,
      });
    }
  });

// TODO when moving to pure ESM change void to await
void cli.parseAsync(process.argv);
