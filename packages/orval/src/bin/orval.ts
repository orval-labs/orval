#!/usr/bin/env node
import { isString, logError, startMessage } from '@orval/core';
import { cac } from 'cac';
import pkg from '../../package.json';
import { generateConfig, generateSpec } from '../generate';
import { normalizeOptions } from '../utils/options';
import { startWatcher } from '../utils/watcher';
import { writeLastCommit } from '../utils/write-last-commit';

const cli = cac('orval');

startMessage({
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
});

cli.version(pkg.version);

cli
  .command(
    '[config]',
    'generate client with appropriate type-signatures from OpenAPI specs',
    {
      ignoreOptionDefaultValue: true,
    },
  )
  .option('-o, --output <path>', 'output file destination')
  .option('-i, --input <path>', 'input file (yaml or json openapi specs)')
  .option('-c, --config <path>', 'override flags by a config file')
  .option('-p, --project <name>', 'focus a project of the config')
  .option('-m, --mode <name>', 'default mode that will be used')
  .option('-c, --client <name>', 'default client that will be used')
  .option('--mock', 'activate the mock')
  .option(
    '-w, --watch [path]',
    'Watch mode, if path is not specified, it watches the input target',
  )
  .option('--clean [path]', 'Clean output directory')
  .option('--prettier [path]', 'Prettier generated files')
  .option('--tslint [path]', 'tslint generated files')
  .option('--biome [path]', 'biome generated files')
  .option('--tsconfig [path]', 'path to your tsconfig file')
  .option('--onChanges', 'only generate when the input file changes')
  .action(async (paths, cmd) => {
    if (!cmd.config && isString(cmd.input) && isString(cmd.output)) {
      const normalizedOptions = await normalizeOptions({
        input: cmd.input,
        output: {
          target: cmd.output,
          clean: cmd.clean,
          prettier: cmd.prettier,
          tslint: cmd.tslint,
          biome: cmd.biome,
          mock: cmd.mock,
          client: cmd.client,
          mode: cmd.mode,
          tsconfig: cmd.tsconfig,
          onChanges: cmd.onChanges,
        },
      });

      if (cmd.watch) {
        startWatcher(
          cmd.watch,
          async () => {
            try {
              await generateSpec(process.cwd(), normalizedOptions);
              await writeLastCommit(process.cwd());
            } catch (e) {
              logError(e);
            }
          },
          normalizedOptions.input.target as string,
        );
      } else {
        try {
          await generateSpec(process.cwd(), normalizedOptions);
          await writeLastCommit(process.cwd());
        } catch (e) {
          logError(e);
        }
      }
    } else {
      await generateConfig(cmd.config, {
        projectName: cmd.project,
        watch: cmd.watch,
        clean: cmd.clean,
        prettier: cmd.prettier,
        tslint: cmd.tslint,
        biome: cmd.biome,
        mock: cmd.mock,
        client: cmd.client,
        mode: cmd.mode,
        tsconfig: cmd.tsconfig,
        input: cmd.input,
        output: cmd.output,
        onChanges: cmd.onChanges,
      });
    }
  });

cli.help();

cli.parse(process.argv);
