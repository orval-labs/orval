#!/usr/bin/env node
import { Command } from 'commander';
import pkg from '../../package.json';
import { generateConfig, generateSpec } from '../generate';
import { isString } from '../utils/is';
import { startMessage } from '../utils/messages/logs';
import { normalizeOptions } from '../utils/options';
import { startWatcher } from '../utils/watcher';

const program = new Command();

startMessage({
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
});

program.version(pkg.version);

program
  .command('default [open-api-file]', { isDefault: true, hidden: true })
  .description('generate orval type-safe from OpenAPI specs')
  .option('-o, --output <path>', 'output file destination')
  .option('-i, --input <path>', 'input file (yaml or json openapi specs)')
  .option('-c, --config <path>', 'override flags by a config file')
  .option('-p, --project <name>', 'focus a project of the config')
  .option(
    '-w, --watch [path]',
    'Watch mode, if path is not specified, it watches the input target',
  )
  .action(async (paths, cmd) => {
    if (isString(cmd.input) && isString(cmd.output)) {
      const normalizedOptions = await normalizeOptions({
        input: cmd.input,
        output: cmd.output,
      });

      if (cmd.watch) {
        startWatcher(
          cmd.watch,
          () => generateSpec(process.cwd(), normalizedOptions),
          normalizedOptions.input.target as string,
        );
      } else {
        generateSpec(process.cwd(), normalizedOptions);
      }
    } else {
      generateConfig(cmd.config, cmd.project, cmd.watch);
    }
  });

program.parse(process.argv);
