#!/usr/bin/env node
import { cac } from 'cac';
import pkg from '../../package.json';
import { generateConfig, generateSpec } from '../generate';
import { isString } from '../utils/is';
import { startMessage } from '../utils/messages/logs';
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
  .command('[config]', 'generate client with appropriate type-signatures from OpenAPI specs', {
    ignoreOptionDefaultValue: true,
  })
  .option('-o, --output <path>', 'output file destination')
  .option('-i, --input <path>', 'input file (yaml or json openapi specs)')
  .option('-c, --config <path>', 'override flags by a config file')
  .option('-p, --project <name>', 'focus a project of the config')
  .option(
    '-w, --watch [path]',
    'Watch mode, if path is not specified, it watches the input target',
  )
  .option('--clean [path]', 'Clean output directory')
  .action(async (paths, cmd) => {
    if (isString(cmd.input) && isString(cmd.output)) {
      const normalizedOptions = await normalizeOptions({
        input: cmd.input,
        output: { target: cmd.output, clean: cmd.clean },
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
      generateConfig(cmd.config, {
        projectName: cmd.project,
        watch: cmd.watch,
        clean: cmd.clean,
      });
    }
  });

cli.help();

cli.parse(process.argv);
