import chalk from 'chalk';
import program from 'commander';
import {readFileSync} from 'fs';
import {join} from 'path';

const {name, version, description} = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf-8')
);

console.log(
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
