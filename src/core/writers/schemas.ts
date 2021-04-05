import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { InfoObject } from 'openapi3-ts';
import { join } from 'path';
import { GeneratorSchema } from '../../types/generator';
import { writeModels } from './models';

export const writeSchemas = ({
  workspace,
  schemaPath,
  schemas,
  info,
  refSpec = false,
}: {
  workspace: string;
  schemaPath: string;
  schemas: GeneratorSchema[];
  info: InfoObject;
  refSpec?: boolean;
}) => {
  if (!existsSync(schemaPath)) {
    mkdirSync(schemaPath);
  }

  if (!existsSync(schemaPath + '/index.ts')) {
    writeFileSync(join(schemaPath, '/index.ts'), '');
  }

  writeModels(schemas, schemaPath, info, refSpec);
};
