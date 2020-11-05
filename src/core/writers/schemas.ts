import { existsSync, mkdirSync } from 'fs';
import { InfoObject } from 'openapi3-ts';
import { join } from 'path';
import { OutputOptions } from '../../types';
import { GeneratorSchema } from '../../types/generator';
import { writeModels } from './models';

export const writeSchemas = ({
  workspace,
  output,
  schemas,
  info,
}: {
  workspace: string;
  output: OutputOptions;
  schemas: GeneratorSchema[];
  info: InfoObject;
}) => {
  if (!output.schemas) {
    return;
  }

  const schemaPath = join(workspace, output.schemas);

  if (!existsSync(schemaPath)) {
    mkdirSync(schemaPath);
  }

  /*  writeFileSync(join(schemaPath, '/index.ts'), ''); */

  writeModels(schemas, schemaPath, info);
};
