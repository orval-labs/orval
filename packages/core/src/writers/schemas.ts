import fs from 'fs-extra';

import { generateImports } from '../generators';
import { type GeneratorSchema, NamingConvention } from '../types';
import { conventionName, upath } from '../utils';

const getSchema = ({
  schema: { imports, model },
  target,
  isRootKey,
  specsName,
  header,
  specKey,
  namingConvention = NamingConvention.CAMEL_CASE,
}: {
  schema: GeneratorSchema;
  target: string;
  isRootKey: boolean;
  specsName: Record<string, string>;
  header: string;
  specKey: string;
  namingConvention?: NamingConvention;
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
    namingConvention,
  });
  file += imports.length > 0 ? '\n\n' : '\n';
  file += model;
  return file;
};

const getPath = (path: string, name: string, fileExtension: string): string =>
  upath.join(path, `/${name}${fileExtension}`);

export const writeModelInline = (acc: string, model: string): string =>
  acc + `${model}\n`;

export const writeModelsInline = (array: GeneratorSchema[]): string =>
  array.reduce((acc, { model }) => writeModelInline(acc, model), '');

export const writeSchema = async ({
  path,
  schema,
  target,
  namingConvention,
  fileExtension,
  specKey,
  isRootKey,
  specsName,
  header,
}: {
  path: string;
  schema: GeneratorSchema;
  target: string;
  namingConvention: NamingConvention;
  fileExtension: string;
  specKey: string;
  isRootKey: boolean;
  specsName: Record<string, string>;
  header: string;
}) => {
  const name = conventionName(schema.name, namingConvention);

  try {
    await fs.outputFile(
      getPath(path, name, fileExtension),
      getSchema({
        schema,
        target,
        isRootKey,
        specsName,
        header,
        specKey,
        namingConvention,
      }),
    );
  } catch (error) {
    throw `Oups... 🍻. An Error occurred while writing schema ${name} => ${error}`;
  }
};

export const writeSchemas = async ({
  schemaPath,
  schemas,
  target,
  namingConvention,
  fileExtension,
  specKey,
  isRootKey,
  specsName,
  header,
  indexFiles,
}: {
  schemaPath: string;
  schemas: GeneratorSchema[];
  target: string;
  namingConvention: NamingConvention;
  fileExtension: string;
  specKey: string;
  isRootKey: boolean;
  specsName: Record<string, string>;
  header: string;
  indexFiles: boolean;
}) => {
  await Promise.all(
    schemas.map((schema) =>
      writeSchema({
        path: schemaPath,
        schema,
        target,
        namingConvention,
        fileExtension,
        specKey,
        isRootKey,
        specsName,
        header,
      }),
    ),
  );

  if (indexFiles) {
    const schemaFilePath = upath.join(schemaPath, `/index${fileExtension}`);
    await fs.ensureFile(schemaFilePath);

    // Ensure separate files are used for parallel schema writing.
    // Throw an exception, which list all duplicates, before attempting
    // multiple writes on the same file.
    const schemaNamesSet = new Set<string>();
    const duplicateNamesMap = new Map<string, number>();
    for (const schema of schemas) {
      if (schemaNamesSet.has(schema.name)) {
        duplicateNamesMap.set(
          schema.name,
          (duplicateNamesMap.get(schema.name) || 1) + 1,
        );
      } else {
        schemaNamesSet.add(schema.name);
      }
    }
    if (duplicateNamesMap.size > 0) {
      throw new Error(
        'Duplicate schema names detected:\n' +
          [...duplicateNamesMap]
            .map((duplicate) => `  ${duplicate[1]}x ${duplicate[0]}`)
            .join('\n'),
      );
    }

    try {
      const data = await fs.readFile(schemaFilePath);

      const stringData = data.toString();

      const ext = fileExtension.endsWith('.ts')
        ? fileExtension.slice(0, -3)
        : fileExtension;

      const importStatements = schemas
        .filter((schema) => {
          const name = conventionName(schema.name, namingConvention);

          return (
            !stringData.includes(`export * from './${name}${ext}'`) &&
            !stringData.includes(`export * from "./${name}${ext}"`)
          );
        })
        .map(
          (schema) =>
            `export * from './${conventionName(schema.name, namingConvention)}${ext}';`,
        );

      const currentFileExports = (stringData
        .match(/export \* from(.*)('|")/g)
        ?.map((s) => s + ';') ?? []) as string[];

      const exports = [...currentFileExports, ...importStatements]
        .sort()
        .join('\n');

      const fileContent = `${header}\n${exports}`;

      await fs.writeFile(schemaFilePath, fileContent);
    } catch (error) {
      throw `Oups... 🍻. An Error occurred while writing schema index file ${schemaFilePath} => ${error}`;
    }
  }
};
