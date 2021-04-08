import { appendFile, ensureFile, readFile, writeFile } from 'fs-extra';
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

export const writeSchema = async ({
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
  try {
    await writeFile(
      getPath(path, name),
      getSchema({ info, schema, rootSpecKey, isRootKey, specsName }),
    );
    const indexPath = getPath(path, 'index');

    const data = await readFile(indexPath);

    const stringData = data.toString();
    if (
      !stringData.includes(`export * from './${name}'`) &&
      !stringData.includes(`export * from "./${name}"`)
    ) {
      await appendFile(getPath(path, 'index'), `export * from './${name}';\n`);
    }
  } catch (e) {
    throw `Oups... 🍻. An Error occurred while writing schema ${name} => ${e}`;
  }
};

export const writeSchemas = async ({
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
  await ensureFile(join(schemaPath, '/index.ts'));

  return Promise.all(
    schemas.map((schema) =>
      writeSchema({
        path: schemaPath,
        info,
        schema,
        rootSpecKey,
        isRootKey,
        specsName,
      }),
    ),
  );
};
