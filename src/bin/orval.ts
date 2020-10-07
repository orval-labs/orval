import program from 'commander';
import { generateConfig, generateSpec } from '../generate';
import { isString } from '../utils/is';
import { startMessage } from '../utils/messages/logs';
import { getPackage } from '../utils/packages';

const { name, version, description } = getPackage();

startMessage({ name, version, description });

program.version(version);

program
  .command('default [open-api-file]', { isDefault: true, hidden: true })
  .description('generate orval type-safe from OpenAPI specs')
  .option('-o, --output <path>', 'output file destination')
  .option('-i, --input <path>', 'input file (yaml or json openapi specs)')
  .option('-c, --config <path>', 'override flags by a config file')
  .option('-p, --project <name>', 'focus a project of the config')
  .action((paths, cmd) => {
    if (isString(cmd.input) && isString(cmd.output)) {
      generateSpec(process.cwd(), { input: cmd.input, output: cmd.output });
    } else {
      generateConfig(cmd.config, cmd.project);
    }
  });

program.parse(process.argv);
