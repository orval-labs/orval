import { ensureFile, outputFile, writeFile } from 'fs-extra';
import { join } from 'upath';
import { GeneratorSchema } from '../../types/generator';
import { camel } from '../../utils/case';
import { generateImports, generateModelImports } from '../generators/imports';

const getSchema = ({
  schema: { imports, model },
  target,
  isRootKey,
  specsName,
  header,
}: {
  schema: GeneratorSchema;
  target: string;
  isRootKey: boolean;
  specsName: Record<string, string>;
  header: string;
}): string => {
  let file = header;
  file += generateImports({
    imports: imports.filter(
      (imp) =>
        !model.includes(`type ${imp.alias || imp.name} =`) &&
        !model.includes(`interface ${imp.alias || imp.name} {`),
    ),
    target,
    isRootKey,
    specsName,
  });
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
  schema,
  target,
  isRootKey,
  specsName,
  header,
}: {
  path: string;
  schema: GeneratorSchema;
  target: string;
  isRootKey: boolean;
  specsName: Record<string, string>;
  header: string;
}) => {
  const name = camel(schema.name);
  try {
    await outputFile(
      getPath(path, name),
      getSchema({ schema, target, isRootKey, specsName, header }),
    );
  } catch (e) {
    throw `Oups... 🍻. An Error occurred while writing schema ${name} => ${e}`;
  }
};

export const writeSchemas = async ({
  schemaPath,
  schemas,
  target,
  isRootKey,
  specsName,
  header,
}: {
  schemaPath: string;
  schemas: GeneratorSchema[];
  target: string;
  isRootKey: boolean;
  specsName: Record<string, string>;
  header: string;
}) => {
  const schemaFilePath = join(schemaPath, '/index.ts');
  await ensureFile(schemaFilePath);

  await Promise.all(
    schemas.map((schema) =>
      writeSchema({
        path: schemaPath,
        schema,
        target,
        isRootKey,
        specsName,
        header,
      }),
    ),
  );

  try {
    await writeFile(schemaFilePath, generateModelImports({ schemas }));
  } catch (e) {
    throw `Oups... 🍻. An Error occurred while writing schema index file ${schemaFilePath} => ${e}`;
  }
};
