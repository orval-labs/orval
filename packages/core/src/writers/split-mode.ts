import path from 'node:path';

import { generateModelsInline, generateMutatorImports } from '../generators';
import {
  type MswMockOptions,
  OutputClient,
  OutputMockType,
  type WriteModeProps,
} from '../types';
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
import {
  filterLocalStrictMockTypeImports,
  getFinalizeMockImplementationOptions,
} from './finalize-mock-implementation';
import { generateImportsForBuilder } from './generate-imports-for-builder';
import {
  collectRecoveredSchemaFactoryImports,
  mergeGeneratorImports,
} from './mock-imports';
import {
  buildCrossFileFakerImports,
  buildFakerReexportStatement,
  collapseMswFakerFullOutputs,
  flattenMockOutput,
} from './mock-outputs';
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
  schemaTagMap,
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
      mockOutputsFull,
      mutators,
      clientMutators,
      formData,
      formUrlEncoded,
      paramsSerializer,
      paramsFilter,
      fetchReviver,
    } = generateTarget(builder, output);

    const mswGeneratorEntry = output.mock.generators.find(
      (g): g is MswMockOptions =>
        !isFunction(g) && g.type === OutputMockType.MSW,
    );
    const collapsedFull = collapseMswFakerFullOutputs(mockOutputsFull, {
      mswOperationResponses: mswGeneratorEntry?.operationResponses,
    });
    const mockOutputs = collapsedFull.map((m) => flattenMockOutput(m));

    let implementationData = header;

    const schemaCustomImportPath = getSchemasImportPath(output.schemas);
    const relativeSchemasPath = output.schemas
      ? (schemaCustomImportPath ??
        // `output.schemas(.path)` is a directory. Resolve the relative import
        // to it directly (with the file extension kept) so the path stays
        // correct even when the directory does not exist on disk yet and when
        // its name contains a dot, e.g. `*.schemas` (#3624). Deriving it from
        // `getFileInfo(...).dirname` collapsed to `./.` in those cases.
        upath.getRelativeImportPath(
          targetPath,
          isString(output.schemas) ? output.schemas : output.schemas.path,
          true,
        ))
      : './' +
        filename +
        '.schemas' +
        getImportExtension(extension, output.tsconfig);

    const schemasTarget = output.schemas
      ? // `output.schemas(.path)` already *is* the schemas directory. Use it
        // directly rather than `getFileInfo(...).dirname`, which collapses to
        // the parent directory when the name contains a dot, e.g. `*.schemas`
        // (#3624) — that broke the mock files' schema imports derived from
        // `schemasTarget` via `resolveMockSchemasPath`. For a dot-free name
        // `getFileInfo(...).dirname` returns the same directory, so existing
        // output is unchanged.
        isString(output.schemas)
        ? output.schemas
        : output.schemas.path
      : path.join(
          dirname,
          filename +
            '.schemas' +
            getImportExtension(extension, output.tsconfig),
        );

    const isAllowSyntheticDefaultImports = isSyntheticDefaultImportsAllow(
      output.tsconfig,
    );

    const importsForBuilder = generateImportsForBuilder(
      output,
      imports,
      relativeSchemasPath,
      schemaTagMap,
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

    const hasFaker = mockOutputs.some((m) => m.type === OutputMockType.FAKER);
    // Only import from the faker file when the collapse actually moved the
    // factories there, importing names that are still declared locally would
    // clash.
    const mswFactoriesMoved =
      hasFaker &&
      collapsedFull.some(
        (m) =>
          m.type === OutputMockType.MSW &&
          m.implementation.function.trim().length === 0,
      );
    const fakerImplementation =
      mockOutputs.find((m) => m.type === OutputMockType.FAKER)
        ?.implementation ?? '';
    const fakerEntry = output.mock.generators.find(
      (g) => !isFunction(g) && g.type === OutputMockType.FAKER,
    );
    const fakerDir = fakerEntry
      ? (getMockDir(fakerEntry, output.mock) ?? dirname)
      : dirname;
    const fakerFilePath = path.join(fakerDir, filename + '.faker' + extension);
    const fakerImportExtension = getImportExtension(extension, output.tsconfig);

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

      const usesSchemaFactories =
        !isFunction(rawEntry) &&
        rawEntry.type === OutputMockType.FAKER &&
        rawEntry.schemas === true;
      const recoveredSchemaFactoryImports =
        usesSchemaFactories && output.schemas
          ? collectRecoveredSchemaFactoryImports(
              finalizedMockImplementation,
              builder.schemas.filter((s) => s.schema).map((s) => s.name),
            )
          : [];

      const crossFileFakerImports =
        mswFactoriesMoved && mockOutput.type === OutputMockType.MSW
          ? buildCrossFileFakerImports(
              mockFilePath,
              fakerFilePath,
              mockOutput.implementation,
              fakerImplementation,
              fakerImportExtension,
            )
          : [];

      const importsMockForBuilder = generateImportsForBuilder(
        output,
        filterLocalStrictMockTypeImports(
          mergeGeneratorImports(
            mockOutput.imports,
            recoveredSchemaFactoryImports,
            crossFileFakerImports,
          ),
          finalizeMockOptions.strictSchemaTypeNames,
        ),
        mockRelativeSchemasPath,
        schemaTagMap,
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
      // Re-export the factories so importing them from the msw file keeps
      // working.
      mockData += buildFakerReexportStatement(crossFileFakerImports);
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
