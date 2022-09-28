#!/usr/bin/env node
import { cac } from 'cac';
import chalk from 'chalk';
import pkg from '../../package.json';
import { generateConfig, generateSpec } from '../generate';
import { isString } from '../utils/is';
import { log, startMessage } from '../utils/messages/logs';
import { normalizeOptions } from '../utils/options';
import { startWatcher } from '../utils/watcher';

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
  .option('--tsconfig [path]', 'path to your tsconfig file')
  .action(async (paths, cmd) => {
    if (!cmd.config && isString(cmd.input) && isString(cmd.output)) {
      const normalizedOptions = await normalizeOptions({
        input: cmd.input,
        output: {
          target: cmd.output,
          clean: cmd.clean,
          prettier: cmd.prettier,
          tslint: cmd.tslint,
          mock: cmd.mock,
          client: cmd.client,
          mode: cmd.mode,
          tsconfig: cmd.tsconfig,
        },
      });

      if (cmd.watch) {
        startWatcher(
          cmd.watch,
          async () => {
            try {
              await generateSpec(process.cwd(), normalizedOptions);
            } catch (e) {
              log(chalk.red(`🛑  ${e}`));
            }
          },
          normalizedOptions.input.target as string,
        );
      } else {
        try {
          await generateSpec(process.cwd(), normalizedOptions);
        } catch (e) {
          log(chalk.red(`🛑  ${e}`));
        }
      }
    } else {
      await generateConfig(cmd.config, {
        projectName: cmd.project,
        watch: cmd.watch,
        clean: cmd.clean,
        prettier: cmd.prettier,
        tslint: cmd.tslint,
        mock: cmd.mock,
        client: cmd.client,
        mode: cmd.mode,
        tsconfig: cmd.tsconfig,
        input: cmd.input,
        output: cmd.output,
      });
    }
  });

cli.help();

cli.parse(process.argv);
