import path from 'node:path';

import { generateModelsInline, generateMutatorImports } from '../generators';
import { OutputMockType, type WriteModeProps } from '../types';
import {
  conventionName,
  getFileInfo,
  getImportExtension,
  getSchemasImportPath,
  isFunction,
  isString,
  isSyntheticDefaultImportsAllow,
  upath,
} from '../utils';
import { getMockFileExtensionByTypeName } from '../utils/file-extensions';
import { escapeRegExp } from '../utils/string';
import { writeGeneratedFile } from './file';
import { getFinalizeMockImplementationOptions } from './finalize-mock-implementation';
import { generateImportsForBuilder } from './generate-imports-for-builder';
import { collapseInlineMockOutputs } from './mock-outputs';
import {
  getMockDir,
  hasAnyMockPath,
  resolveMockSchemasPath,
} from './mock-utils';
import { generateTarget } from './target';
import { getOrvalGeneratedTypes, getTypedResponse } from './types';

export async function writeSingleMode({
  builder,
  output,
  projectName,
  header,
  needSchema,
  generateSchemasInline,
}: WriteModeProps): Promise<string[]> {
  try {
    const {
      path: targetPath,
      filename,
      dirname,
      extension,
    } = getFileInfo(output.target, {
      backupFilename: conventionName(
        builder.info.title ?? 'filename',
        output.namingConvention,
      ),
      extension: output.fileExtension,
    });

    const {
      imports,
      mockOutputs: rawMockOutputs,
      implementation,
      mutators,
      clientMutators,
      formData,
      formUrlEncoded,
      paramsSerializer,
      paramsFilter,
      fetchReviver,
    } = generateTarget(builder, output);

    const isAllowSyntheticDefaultImports = isSyntheticDefaultImportsAllow(
      output.tsconfig,
    );

    const shouldDeinlineMocks = hasAnyMockPath(output.mock);

    const schemaCustomImportPath = getSchemasImportPath(output.schemas);
    const schemasPath = output.schemas
      ? (schemaCustomImportPath ??
        upath.getRelativeImportPath(
          targetPath,
          getFileInfo(
            isString(output.schemas) ? output.schemas : output.schemas.path,
            { extension: output.fileExtension },
          ).dirname,
        ))
      : undefined;

    const relativeSchemasPath =
      schemasPath ??
      './' + filename + '.schemas' + extension.replace(/\.ts$/, '');

    const schemasTarget = output.schemas
      ? getFileInfo(
          isString(output.schemas) ? output.schemas : output.schemas.path,
          { extension: output.fileExtension },
        ).dirname
      : targetPath;

    const implementationImports = imports.filter((imp) => {
      const searchWords = [imp.alias, imp.name]
        .filter((part): part is string => Boolean(part?.length))
        .map((part) => escapeRegExp(part))
        .join('|');
      if (!searchWords) {
        return false;
      }

      return new RegExp(String.raw`\b(${searchWords})\b`, 'g').test(
        implementation,
      );
    });

    const normalizedImports = implementationImports.map((imp) => ({ ...imp }));

    const collapsedMockOutputs = shouldDeinlineMocks
      ? []
      : collapseInlineMockOutputs(rawMockOutputs);

    if (!shouldDeinlineMocks) {
      const importsMock = collapsedMockOutputs.flatMap((m) => m.imports);

      for (const mockImport of importsMock) {
        const matchingImport = normalizedImports.find(
          (imp) =>
            imp.name === mockImport.name &&
            (imp.alias ?? '') === (mockImport.alias ?? ''),
        );
        if (!matchingImport) continue;

        const mockNeedsRuntimeValue =
          !!mockImport.values ||
          !!mockImport.isConstant ||
          !!mockImport.default ||
          !!mockImport.namespaceImport ||
          !!mockImport.syntheticDefaultImport;
        if (mockNeedsRuntimeValue) {
          matchingImport.values = true;
        }
      }
    }

    let data = header;

    const importsForBuilder = schemasPath
      ? generateImportsForBuilder(
          output,
          normalizedImports,
          relativeSchemasPath,
        )
      : generateImportsForBuilder(
          output,
          normalizedImports.filter((imp) => !!imp.importPath),
          '.',
        );

    data += builder.imports({
      client: output.client,
      implementation,
      imports: importsForBuilder,
      projectName,
      hasSchemaDir: !!output.schemas,
      isAllowSyntheticDefaultImports,
      hasGlobalMutator: !!output.override.mutator,
      hasTagsMutator: Object.values(output.override.tags).some(
        (tag) => !!tag?.mutator,
      ),
      hasParamsSerializerOptions: !!output.override.paramsSerializerOptions,
      packageJson: output.packageJson,
      output,
    });

    if (!shouldDeinlineMocks) {
      for (const mockOutput of collapsedMockOutputs) {
        const entry = output.mock.generators.find(
          (g) => !isFunction(g) && g.type === mockOutput.type,
        );
        const filteredMockImports = mockOutput.imports.filter(
          (impMock) =>
            !normalizedImports.some(
              (imp) =>
                imp.name === impMock.name &&
                (imp.alias ?? '') === (impMock.alias ?? ''),
            ),
        );
        const importsMockForBuilder = schemasPath
          ? generateImportsForBuilder(
              output,
              filteredMockImports,
              relativeSchemasPath,
            )
          : generateImportsForBuilder(
              output,
              filteredMockImports.filter((imp) => !!imp.importPath),
              '.',
            );
        data += builder.importsMock({
          implementation: mockOutput.implementation,
          imports: importsMockForBuilder,
          projectName,
          hasSchemaDir: !!output.schemas,
          isAllowSyntheticDefaultImports,
          options: entry && !isFunction(entry) ? entry : undefined,
        });
      }
    }

    if (mutators) {
      data += generateMutatorImports({ mutators, implementation });
    }

    if (clientMutators) {
      data += generateMutatorImports({ mutators: clientMutators });
    }

    if (formData) {
      data += generateMutatorImports({ mutators: formData });
    }

    if (formUrlEncoded) {
      data += generateMutatorImports({ mutators: formUrlEncoded });
    }

    if (paramsSerializer) {
      data += generateMutatorImports({ mutators: paramsSerializer });
    }

    if (paramsFilter) {
      data += generateMutatorImports({ mutators: paramsFilter });
    }

    if (fetchReviver) {
      data += generateMutatorImports({ mutators: fetchReviver });
    }

    if (implementation.includes('NonReadonly<')) {
      data += getOrvalGeneratedTypes();
      data += '\n';
    }

    if (implementation.includes('TypedResponse<')) {
      data += getTypedResponse();
      data += '\n';
    }

    if (!output.schemas && needSchema) {
      data += generateSchemasInline
        ? generateSchemasInline()
        : generateModelsInline(builder.schemas);
    }

    data += `${implementation.trim()}\n`;

    if (!shouldDeinlineMocks) {
      const implementationMock = collapsedMockOutputs
        .map((m) => m.implementation)
        .join('\n\n');
      const finalizedImplementationMock = builder.finalizeMockImplementation
        ? builder.finalizeMockImplementation(
            implementationMock,
            getFinalizeMockImplementationOptions(output, collapsedMockOutputs),
          )
        : implementationMock;

      if (collapsedMockOutputs.length > 0) {
        data += '\n\n';
        data += finalizedImplementationMock;
      }
    }

    await writeGeneratedFile(targetPath, data);

    const extraPaths: string[] = [];

    if (shouldDeinlineMocks) {
      const seenMockIndexKeys = new Set<string>();
      const writtenMockEntries: {
        extension: OutputMockType;
        mockDir: string;
      }[] = [];

      for (const mockOutput of rawMockOutputs) {
        const rawEntry = output.mock.generators.find((g) => {
          if (isFunction(g)) return mockOutput.type === OutputMockType.MSW;
          return g.type === mockOutput.type;
        });
        if (!rawEntry) continue;

        const mockExtension = isFunction(rawEntry)
          ? OutputMockType.MSW
          : getMockFileExtensionByTypeName(rawEntry);
        const mockDir = getMockDir(rawEntry, output.mock) ?? dirname;

        const mockFilePath = path.join(
          mockDir,
          filename + '.' + mockExtension + extension,
        );

        const mockRelativeSchemasPath =
          schemaCustomImportPath ??
          resolveMockSchemasPath(mockFilePath, schemasTarget);

        const importsMockForBuilder =
          schemasPath || mockDir !== dirname
            ? generateImportsForBuilder(
                output,
                mockOutput.imports,
                mockRelativeSchemasPath,
              )
            : generateImportsForBuilder(
                output,
                mockOutput.imports.filter((imp) => !!imp.importPath),
                '.',
              );

        let mockData = header;
        const finalizedMockImplementation = builder.finalizeMockImplementation
          ? builder.finalizeMockImplementation(
              mockOutput.implementation,
              getFinalizeMockImplementationOptions(output, mockOutput),
            )
          : mockOutput.implementation;
        mockData += builder.importsMock({
          implementation: finalizedMockImplementation,
          imports: importsMockForBuilder,
          projectName,
          hasSchemaDir: !!output.schemas,
          isAllowSyntheticDefaultImports,
          options: isFunction(rawEntry) ? undefined : rawEntry,
        });
        mockData += `\n${finalizedMockImplementation}`;

        await writeGeneratedFile(mockFilePath, mockData);
        extraPaths.push(mockFilePath);

        const indexKey = `${mockExtension}::${mockDir}`;
        if (!seenMockIndexKeys.has(indexKey)) {
          seenMockIndexKeys.add(indexKey);
          writtenMockEntries.push({ extension: mockExtension, mockDir });
        }
      }

      if (output.mock.indexMockFiles) {
        const importExtension = getImportExtension(
          output.fileExtension,
          output.tsconfig,
        );
        for (const { extension: mockExt, mockDir } of writtenMockEntries) {
          const indexMockPath = path.join(
            mockDir,
            `index.${mockExt}${extension}`,
          );
          await writeGeneratedFile(
            indexMockPath,
            `export * from './${filename}.${mockExt}${importExtension}'\n`,
          );
          extraPaths.push(indexMockPath);
        }
      }
    }

    return [targetPath, ...extraPaths];
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'unknown error';
    throw new Error(
      `Oups... 🍻. An Error occurred while writing file => ${errorMsg}`,
      { cause: error },
    );
  }
}
