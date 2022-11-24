import fs from 'fs-extra';
import { join } from 'path';
import { generateImports } from '../generators';
import { GeneratorSchema } from '../types';
import { camel } from '../utils';

const getSchema = ({
  schema: { imports, model },
  target,
  isRootKey,
  specsName,
  header,
  specKey,
}: {
  schema: GeneratorSchema;
  target: string;
  isRootKey: boolean;
  specsName: Record<string, string>;
  header: string;
  specKey: string;
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
    specKey,
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
  specKey,
  isRootKey,
  specsName,
  header,
}: {
  path: string;
  schema: GeneratorSchema;
  target: string;
  specKey: string;
  isRootKey: boolean;
  specsName: Record<string, string>;
  header: string;
}) => {
  const name = camel(schema.name);

  try {
    await fs.outputFile(
      getPath(path, name),
      getSchema({ schema, target, isRootKey, specsName, header, specKey }),
    );
  } catch (e) {
    throw `Oups... 🍻. An Error occurred while writing schema ${name} => ${e}`;
  }
};

export const writeSchemas = async ({
  schemaPath,
  schemas,
  target,
  specKey,
  isRootKey,
  specsName,
  header,
}: {
  schemaPath: string;
  schemas: GeneratorSchema[];
  target: string;
  specKey: string;
  isRootKey: boolean;
  specsName: Record<string, string>;
  header: string;
}) => {
  const schemaFilePath = join(schemaPath, '/index.ts');
  await fs.ensureFile(schemaFilePath);

  await Promise.all(
    schemas.map((schema) =>
      writeSchema({
        path: schemaPath,
        schema,
        target,
        specKey,
        isRootKey,
        specsName,
        header,
      }),
    ),
  );

  try {
    const data = await fs.readFile(schemaFilePath);

    const stringData = data.toString();

    const importStatements = schemas
      .filter((schema) => {
        return (
          !stringData.includes(`export * from './${camel(schema.name)}'`) &&
          !stringData.includes(`export * from "./${camel(schema.name)}"`)
        );
      })
      .map((schema) => `export * from './${camel(schema.name)}';`);

    const currentFileExports = (stringData
      .match(/export \* from(.*)('|")/g)
      ?.map((s) => s + ';') ?? []) as string[];

    const fileContent = [...currentFileExports, ...importStatements]
      .sort()
      .join('\n');

    await fs.writeFile(schemaFilePath, fileContent);
  } catch (e) {
    throw `Oups... 🍻. An Error occurred while writing schema index file ${schemaFilePath} => ${e}`;
  }
};
