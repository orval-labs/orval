import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFile,
  writeFileSync,
} from 'fs';
import { InfoObject } from 'openapi3-ts';
import { join } from 'path';
import { GeneratorSchema } from '../../types/generator';
import { camel } from '../../utils/case';
import { getFilesHeader } from '../../utils/messages/inline';
import { generateImports } from '../generators/imports';

const getSchema = ({
  info,
  schema: { imports, model },
  rootSpecKey,
  isRootKey,
  specsName,
}: {
  info: InfoObject;
  schema: GeneratorSchema;
  rootSpecKey: string;
  isRootKey: boolean;
  specsName: Record<string, string>;
}): string => {
  let file = getFilesHeader(info);
  file += generateImports({ imports, rootSpecKey, isRootKey, specsName });
  file += imports.length ? '\n\n' : '\n';
  file += model;
  return file;
};

const getPath = (path: string, name: string): string =>
  join(path, `/${name}.ts`);

export const writeModelInline = (acc: string, model: string): string =>
  acc + `${model}\n`;

export const writeModelsInline = (array: GeneratorSchema[]): string =>
  array.reduce((acc, { model }) => writeModelInline(acc, model), '');

export const writeSchema = ({
  path,
  info,
  schema,
  rootSpecKey,
  isRootKey,
  specsName,
}: {
  path: string;
  info: InfoObject;
  schema: GeneratorSchema;
  rootSpecKey: string;
  isRootKey: boolean;
  specsName: Record<string, string>;
}) => {
  const name = camel(schema.name);
  writeFileSync(
    getPath(path, name),
    getSchema({ info, schema, rootSpecKey, isRootKey, specsName }),
  );
  const indexPath = getPath(path, 'index');

  readFile(indexPath, function (err, data) {
    if (err) throw err;
    const stringData = data.toString();
    if (
      !stringData.includes(`export * from './${name}'`) &&
      !stringData.includes(`export * from "./${name}"`)
    ) {
      appendFileSync(getPath(path, 'index'), `export * from './${name}';\n`);
    }
  });
};

export const writeSchemas = ({
  workspace,
  schemaPath,
  schemas,
  info,
  rootSpecKey,
  isRootKey,
  specsName,
}: {
  workspace: string;
  schemaPath: string;
  schemas: GeneratorSchema[];
  info: InfoObject;
  rootSpecKey: string;
  isRootKey: boolean;
  specsName: Record<string, string>;
}) => {
  if (!existsSync(schemaPath)) {
    mkdirSync(schemaPath);
  }

  if (!existsSync(schemaPath + '/index.ts')) {
    writeFileSync(join(schemaPath, '/index.ts'), '');
  }

  schemas.forEach((schema) =>
    writeSchema({
      path: schemaPath,
      info,
      schema,
      rootSpecKey,
      isRootKey,
      specsName,
    }),
  );
};
