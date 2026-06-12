import nodePath from 'node:path';

import {
  type GeneratorImport,
  type GeneratorSchema,
  type NamingConvention,
  type Tsconfig,
} from '../types';
import { conventionName, getImportExtension, upath } from '../utils';
import { writeGeneratedFile } from './file';
import { buildSchemaTagMap } from './schema-tag-mapper';
import { writeSchemas } from './schemas';

const ROOT = '.';

interface WriteSchemasTagsSplitOptions {
  schemaPath: string;
  schemas: GeneratorSchema[];
  target: string;
  namingConvention: NamingConvention;
  fileExtension: string;
  header: string;
  indexFiles: boolean;
  tsconfig?: Tsconfig;
  factoryOutputDirectory?: string;
  operations: ReadonlyArray<{ imports: GeneratorImport[]; tags: string[] }>;
}

export async function writeSchemasTagsSplit({
  schemaPath,
  schemas,
  target,
  namingConvention,
  fileExtension,
  header,
  indexFiles,
  tsconfig,
  factoryOutputDirectory,
  operations,
}: WriteSchemasTagsSplitOptions) {
  const schemaTagMap = buildSchemaTagMap(operations, schemas);
  const importExtension = getImportExtension(fileExtension, tsconfig);

  const groups = new Map<string, GeneratorSchema[]>();
  for (const schema of schemas) {
    const group = schemaTagMap.get(schema.name) ?? ROOT;
    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group)!.push(schema);
  }

  for (const [groupDir, groupSchemas] of groups) {
    const isRoot = groupDir === ROOT;
    const groupPath = isRoot ? schemaPath : nodePath.join(schemaPath, groupDir);

    fixCrossTagImports(
      groupSchemas,
      schemaTagMap,
      schemaPath,
      groupDir,
      namingConvention,
      importExtension,
    );

    const groupFactoryDir = factoryOutputDirectory
      ? isRoot
        ? factoryOutputDirectory
        : nodePath.join(factoryOutputDirectory, groupDir)
      : undefined;

    await writeSchemas({
      schemaPath: groupPath,
      schemas: groupSchemas,
      target,
      namingConvention,
      fileExtension,
      header,
      indexFiles: !isRoot && indexFiles,
      tsconfig,
      factoryOutputDirectory: groupFactoryDir,
    });
  }

  if (indexFiles && groups.size > 0) {
    const rootIndexPath = nodePath.join(schemaPath, 'index.ts');

    const rootSchemas = groups.get(ROOT) ?? [];
    const rootExports = rootSchemas.map((s) => {
      const fileName = conventionName(s.name, namingConvention);
      return `export * from './${fileName}${importExtension}';`;
    });

    const tagDirs = [...groups.keys()]
      .filter((dir) => dir !== ROOT)
      .toSorted((a: string, b: string) =>
        a.localeCompare(b, 'en', { numeric: true }),
      );
    const tagExports = tagDirs.map((dir) => {
      const dirPath = importExtension
        ? `./${dir}/index${importExtension}`
        : `./${dir}`;
      return `export * from '${dirPath}';`;
    });

    const allExports = [...rootExports, ...tagExports];
    const content = `${header}\n${allExports.join('\n')}\n`;
    await writeGeneratedFile(rootIndexPath, content);
  }
}

function fixCrossTagImports(
  schemas: GeneratorSchema[],
  schemaTagMap: Map<string, string>,
  schemaPath: string,
  currentGroupDir: string,
  namingConvention: NamingConvention,
  importExtension: string,
): void {
  const isRoot = currentGroupDir === ROOT;
  const fromPath = isRoot
    ? schemaPath
    : nodePath.join(schemaPath, currentGroupDir);

  for (const schema of schemas) {
    const fixImports = (imports: GeneratorImport[]) =>
      imports.map((imp) => {
        const targetGroup = schemaTagMap.get(imp.name);
        if (targetGroup === undefined || targetGroup === currentGroupDir) {
          return imp;
        }

        const toPath =
          targetGroup === ROOT
            ? schemaPath
            : nodePath.join(schemaPath, targetGroup);
        const relativePath = upath.relativeSafe(fromPath, toPath);
        const fileName = conventionName(imp.name, namingConvention);
        const importPath =
          upath.joinSafe(relativePath, fileName) + importExtension;

        return { ...imp, importPath };
      });

    schema.imports = fixImports(schema.imports);
    if (schema.factoryImports) {
      schema.factoryImports = fixImports(schema.factoryImports);
    }
  }
}
