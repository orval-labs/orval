import program from 'commander';
import { generateConfig, generateSpec } from '../generate';
import { Options } from '../types';
import { isString } from '../utils/is';
import { errorMessage, startMessage } from '../utils/messages/logs';
import { getPackage } from '../utils/packages';

const { name, version, description } = getPackage();

startMessage({ name, version, description });

program.version(version);

program
  .command('default [open-api-file]', { isDefault: true, hidden: true })
  .description('generate orval type-safe from OpenAPI specs')
  .option('-o, --output [value]', 'output file destination')
  .option('-f, --input [value]', 'input file (yaml or json openapi specs)')
  .option('--config [value]', 'override flags by a config file')
  .action(() => {
    if (isString(program.input) && isString(program.output)) {
      generateSpec(process.cwd(), (program as any) as Options);
    } else {
      generateConfig(program.config);
    }
  });

program
  .command('import [open-api-file]')
  .description('deprecated: generate orval type-safe from OpenAPI specs')
  .option('-o, --output [value]', 'output file destination')
  .option('-f, --input [value]', 'input file (yaml or json openapi specs)')
  .option('--config [value]', 'override flags by a config file')
  .action(() => {
    errorMessage('This command is deprecated just use orval without import');

    if (isString(program.input) && isString(program.output)) {
      generateSpec(process.cwd(), (program as any) as Options);
    } else {
      generateConfig(program.config);
    }
  });

program.parse(process.argv);
