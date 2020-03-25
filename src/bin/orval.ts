import program from 'commander';
import {startMessage} from '../utils/messages/logs';
import {getPackage} from '../utils/packages';

const {name, version, description} = getPackage();

startMessage({name, version, description});

program
  .version(version)
  .command(
    'import [open-api-file]',
    'generate orval type-safe from OpenAPI specs'
  )
  .parse(process.argv);
