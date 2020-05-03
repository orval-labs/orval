import program from 'commander';
import { startMessage } from '../utils/messages/logs';
import { getPackage } from '../utils/packages';

const { name, version, description } = getPackage();

startMessage({ name, version, description });

program
  .version(version)
  .command(
    'import [open-api-file]',
    'deprecated: generate orval type-safe from OpenAPI specs',
  )
  .command(
    'default [open-api-file]',
    'generate orval type-safe from OpenAPI specs',
    { isDefault: true, hidden: true },
  )
  .parse(process.argv);
