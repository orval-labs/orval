import chalk from 'chalk';
import program from 'commander';
import {getPackage} from '../utils/packages';
import { log } from '../utils/messages/logs';

const {name, version, description} = getPackage();

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
