import path from 'node:path';

import { generateModelsInline, generateMutatorImports } from '../generators';
import { OutputClient, OutputMockType, type WriteModeProps } from '../types';
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
import { writeGeneratedFile } from './file';
import { getFinalizeMockImplementationOptions } from './finalize-mock-implementation';
import { generateImportsForBuilder } from './generate-imports-for-builder';
import {
  collectRecoveredSchemaFactoryImports,
  mergeGeneratorImports,
} from './mock-imports';
import { getMockDir, resolveMockSchemasPath } from './mock-utils';
import { generateTarget } from './target';
import { getOrvalGeneratedTypes, getTypedResponse } from './types';

export async function writeSplitMode({
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
      implementation,
      mockOutputs,
      mutators,
      clientMutators,
      formData,
      formUrlEncoded,
      paramsSerializer,
      paramsFilter,
      fetchReviver,
    } = generateTarget(builder, output);

    let implementationData = header;

    const schemaCustomImportPath = getSchemasImportPath(output.schemas);
    const relativeSchemasPath = output.schemas
      ? (schemaCustomImportPath ??
        upath.getRelativeImportPath(
          targetPath,
          getFileInfo(
            isString(output.schemas) ? output.schemas : output.schemas.path,
            { extension: output.fileExtension },
          ).dirname,
        ))
      : './' + filename + '.schemas' + extension.replace(/\.ts$/, '');

    const schemasTarget = output.schemas
      ? getFileInfo(
          isString(output.schemas) ? output.schemas : output.schemas.path,
          { extension: output.fileExtension },
        ).dirname
      : path.join(
          dirname,
          filename + '.schemas' + extension.replace(/\.ts$/, ''),
        );

    const isAllowSyntheticDefaultImports = isSyntheticDefaultImportsAllow(
      output.tsconfig,
    );

    const importsForBuilder = generateImportsForBuilder(
      output,
      imports,
      relativeSchemasPath,
    );

    implementationData += builder.imports({
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

    const schemasPath =
      !output.schemas && needSchema
        ? path.join(dirname, filename + '.schemas' + extension)
        : undefined;

    if (schemasPath) {
      const schemasData = generateSchemasInline
        ? header + generateSchemasInline()
        : header + generateModelsInline(builder.schemas);

      await writeGeneratedFile(schemasPath, schemasData);
    }

    if (mutators) {
      implementationData += generateMutatorImports({
        mutators,
        implementation,
      });
    }

    if (clientMutators) {
      implementationData += generateMutatorImports({
        mutators: clientMutators,
      });
    }

    if (formData) {
      implementationData += generateMutatorImports({ mutators: formData });
    }

    if (formUrlEncoded) {
      implementationData += generateMutatorImports({
        mutators: formUrlEncoded,
      });
    }

    if (paramsSerializer) {
      implementationData += generateMutatorImports({
        mutators: paramsSerializer,
      });
    }

    if (paramsFilter) {
      implementationData += generateMutatorImports({
        mutators: paramsFilter,
      });
    }

    if (fetchReviver) {
      implementationData += generateMutatorImports({
        mutators: fetchReviver,
      });
    }

    if (implementation.includes('NonReadonly<')) {
      implementationData += getOrvalGeneratedTypes();
      implementationData += '\n';
    }

    if (implementation.includes('TypedResponse<')) {
      implementationData += getTypedResponse();
      implementationData += '\n';
    }

    implementationData += `\n${implementation}`;

    const implementationFilename =
      filename +
      (OutputClient.ANGULAR === output.client ? '.service' : '') +
      extension;

    const implementationPath = path.join(dirname, implementationFilename);
    await writeGeneratedFile(implementationPath, implementationData);

    const mockPaths: string[] = [];
    const seenMockIndexKeys = new Set<string>();
    const writtenMockEntries: {
      extension: OutputMockType;
      mockDir: string;
    }[] = [];
    for (const mockOutput of mockOutputs) {
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

      const finalizeMockOptions = getFinalizeMockImplementationOptions(
        output,
        mockOutput,
      );

      const finalizedMockImplementation = builder.finalizeMockImplementation
        ? builder.finalizeMockImplementation(
            mockOutput.implementation,
            finalizeMockOptions,
          )
        : mockOutput.implementation;

      const usesSchemaFactories = output.mock.generators.some(
        (g) =>
          !isFunction(g) &&
          g.type === OutputMockType.FAKER &&
          g.schemas === true,
      );
      const recoveredSchemaFactoryImports =
        usesSchemaFactories && output.schemas
          ? collectRecoveredSchemaFactoryImports(
              finalizedMockImplementation,
              builder.schemas.filter((s) => s.schema).map((s) => s.name),
            )
          : [];

      const importsMockForBuilder = generateImportsForBuilder(
        output,
        mergeGeneratorImports(
          mockOutput.imports,
          recoveredSchemaFactoryImports,
        ),
        mockRelativeSchemasPath,
      );
      let mockData = header;
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
      mockPaths.push(mockFilePath);

      const indexKey = `${mockExtension}::${mockDir}`;
      if (!seenMockIndexKeys.has(indexKey)) {
        seenMockIndexKeys.add(indexKey);
        writtenMockEntries.push({ extension: mockExtension, mockDir });
      }
    }

    const indexMockPaths: string[] = [];
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
        indexMockPaths.push(indexMockPath);
      }
    }

    return [
      implementationPath,
      ...(schemasPath ? [schemasPath] : []),
      ...mockPaths,
      ...indexMockPaths,
    ];
  } catch (error) {
    throw new Error(
      `Oups... 🍻. An Error occurred while splitting => ${String(error)}`,
      { cause: error },
    );
  }
}
