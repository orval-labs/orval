import program from 'commander';
import { generateConfig, generateSpec } from '../generate';
import { Options } from '../types';
import { isString } from '../utils/is';

program.option('-o, --output [value]', 'output file destination');
program.option(
  '-f, --input [value]',
  'input file (yaml or json openapi specs)',
);
program.option('--config [value]', 'override flags by a config file');
program.parse(process.argv);

if (isString(program.input) && isString(program.output)) {
  generateSpec((program as any) as Options);
} else {
  generateConfig(program.config);
}
