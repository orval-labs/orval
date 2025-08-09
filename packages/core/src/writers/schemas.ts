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
  } catch (error) {
    throw new Error(
      `Oups... 🍻. An Error occurred while writing schema ${name} => ${error}`,
    );
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
    const indexFilePath = join(schemaPath, `/index${fileExtension}`);
    await fs.ensureFile(indexFilePath);

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
      const data = await fs.readFile(indexFilePath);

      const stringData = data.toString();

      const isExtensionTS = fileExtension.endsWith('.ts');

      const importStatements = schemas
        .map((schema) => {
          const schemaFilePath = join(
            schemaPath,
            conventionName(schema.name, namingConvention) + fileExtension,
          );
          const relativePath = getRelativeImportPath(
            indexFilePath,
            schemaFilePath,
            !isExtensionTS,
          );

          return relativePath;
        })
        .filter((relativePath) => {
          return (
            !stringData.includes(`export * from '${relativePath}'`) &&
            !stringData.includes(`export * from "${relativePath}"`)
          );
        })
        .map((relativePath) => `export * from '${relativePath}';`);

      const currentFileExports = (stringData
        .match(/export \* from(.*)('|")/g)
        ?.map((s) => s + ';') ?? []) as string[];

      const exports = [...currentFileExports, ...importStatements]
        .sort()
        .join('\n');

      const fileContent = `${header}\n${exports}`;

      await fs.writeFile(schemaFilePath, fileContent);
    } catch (error) {
      throw new Error(
        `Oups... 🍻. An Error occurred while writing schema index file ${schemaFilePath} => ${error}`,
      );
    }
  }
};
