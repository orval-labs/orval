import fs from 'fs-extra';
import { generateImports } from '../generators';
import { GeneratorSchema, NamingConvention } from '../types';
import { conventionName } from '../utils';
import { join } from 'node:path';

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
  file += imports.length ? '\n\n' : '\n';
  file += model;
  return file;
};

export const writeModelInline = (acc: string, model: string): string =>
  acc + `${model}\n`;

export const writeModelsInline = (array: GeneratorSchema[]): string =>
  array.reduce((acc, { model }) => writeModelInline(acc, model), '');

export const writeSchema = async ({
  schemaPath,
  schema,
  target,
  namingConvention,
  fileExtension,
  specKey,
  isRootKey,
  specsName,
  header,
}: {
  schemaPath: string;
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
      join(schemaPath, `${name}${fileExtension}`),
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
  } catch (e) {
    throw `Oups... 🍻. An Error occurred while writing schema ${name} => ${e}`;
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
        schemaPath,
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
    const schemaFilePath = join(schemaPath, `/index${fileExtension}`);
    await fs.ensureFile(schemaFilePath);

    // Ensure separate files are used for parallel schema writing.
    // Throw an exception, which list all duplicates, before attempting
    // multiple writes on the same file.
    const schemaNamesSet = new Set<string>();
    const duplicateNamesMap = new Map<string, number>();
    schemas.forEach((schema) => {
      if (!schemaNamesSet.has(schema.name)) {
        schemaNamesSet.add(schema.name);
      } else {
        duplicateNamesMap.set(
          schema.name,
          (duplicateNamesMap.get(schema.name) || 1) + 1,
        );
      }
    });
    if (duplicateNamesMap.size) {
      throw new Error(
        'Duplicate schema names detected:\n' +
          Array.from(duplicateNamesMap)
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
    } catch (e) {
      throw `Oups... 🍻. An Error occurred while writing schema index file ${schemaFilePath} => ${e}`;
    }
  }
};
