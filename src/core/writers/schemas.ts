import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { InfoObject } from 'openapi3-ts';
import { join } from 'path';
import { OutputOptions } from '../../types';
import { GeneratorSchema } from '../../types/generator';
import { writeModels } from './models';

export const writeSchemas = ({
  output,
  schemas,
  info,
}: {
  output: OutputOptions;
  schemas: GeneratorSchema[];
  info: InfoObject;
}) => {
  if (!output.schemas) {
    return;
  }

  if (!existsSync(output.schemas)) {
    mkdirSync(output.schemas);
  }

  writeFileSync(join(output.schemas, '/index.ts'), '');

  writeModels(schemas, output.schemas, info);
};
