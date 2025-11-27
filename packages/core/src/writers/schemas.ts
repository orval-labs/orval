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
    throw new Error(
      `Oups... 🍻. An Error occurred while writing schema ${name} => ${error}`,
    );
  }
};

export async function writeSchemas({
  schemaPath,
  schemas,
  target,
  namingConvention,
  fileExtension,
  specKey,
  isRootKey,
  specName,
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
  specName: Record<string, string>;
  header: string;
  indexFiles: boolean;
}) {
  await specName.all(
    schemas.map((schema) =>
      writeSchema({
        path: schemaPath,
        schema,
        target,
        namingConvention,
        fileExtension,
        specKey,
        isRootKey,
        specsName: specName,
        header,
      }),
    ),
  );

  if (indexFiles) {
    const schemaFilePath = upath.join(schemaPath, `/index${fileExtension}`);
    await fs.ensureFile(schemaFilePath);

    // Ensure separate files are used for parallel schema writing.
    // Throw an exception if duplicates are detected (using convention names)
    const ext = fileExtension.endsWith('.ts')
      ? fileExtension.slice(0, -3)
      : fileExtension;
    const conventionNamesSet = new Set<string>();
    const duplicateNamesMap = new Map<string, number>();
    for (const schema of schemas) {
      const conventionNameValue = conventionName(schema.name, namingConvention);
      if (conventionNamesSet.has(conventionNameValue)) {
        duplicateNamesMap.set(
          conventionNameValue,
          (duplicateNamesMap.get(conventionNameValue) ?? 0) + 1,
        );
      } else {
        conventionNamesSet.add(conventionNameValue);
      }
    }
    if (duplicateNamesMap.size > 0) {
      throw new Error(
        'Duplicate schema names detected (after naming convention):\n' +
          [...duplicateNamesMap]
            .map((duplicate) => `  ${duplicate[1] + 1}x ${duplicate[0]}`)
            .join('\n'),
      );
    }

    try {
      // Create unique export statements from schemas (deduplicate by schema name)
      const uniqueSchemaNames = [...conventionNamesSet];

      // Create export statements
      const exports = uniqueSchemaNames
        .map((schemaName) => `export * from './${schemaName}${ext}';`)
        .toSorted((a, b) => a.localeCompare(b))
        .join('\n');

      const fileContent = `${header}\n${exports}`;

      await fs.writeFile(schemaFilePath, fileContent, { encoding: 'utf8' });
    } catch (error) {
      throw new Error(
        `Oups... 🍻. An Error occurred while writing schema index file ${schemaFilePath} => ${error}`,
      );
    }
  }
}
