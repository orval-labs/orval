import chalk from 'chalk';
import program from 'commander';
import {log} from '../messages/logs';
import {getConfig} from '../utils/getConfig';

const {name, version, description} = getConfig();

log(
  `🍺 Start ${chalk.cyan.bold(name)} ${chalk.green(
    `v${version}`
  )} - ${description}`
);

program
  .version(version)
  .command(
    'import [open-api-file]',
    'generate orval type-safe from OpenAPI specs'
  )
  .parse(process.argv);
