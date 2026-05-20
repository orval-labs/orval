import { generateModelsInline, generateMutatorImports } from '../generators';
import type { WriteModeProps } from '../types';
import {
  conventionName,
  getFileInfo,
  isFunction,
  isString,
  isSyntheticDefaultImportsAllow,
  upath,
} from '../utils';
import { escapeRegExp } from '../utils/string';
import { writeGeneratedFile } from './file';
import { generateImportsForBuilder } from './generate-imports-for-builder';
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
    const { path } = getFileInfo(output.target, {
      backupFilename: conventionName(
        builder.info.title ?? 'filename',
        output.namingConvention,
      ),
      extension: output.fileExtension,
    });

    const {
      imports,
      mockOutputs,
      implementation,
      mutators,
      clientMutators,
      formData,
      formUrlEncoded,
      paramsSerializer,
      paramsFilter,
      fetchReviver,
    } = generateTarget(builder, output);

    // Combined mock content emitted at the bottom of the single-mode output
    // file (one block per generator entry).
    const implementationMock = mockOutputs
      .map((m) => m.implementation)
      .join('\n\n');
    // Aggregate imports across all mock entries for the value-import promotion
    // pass below.
    const importsMock = mockOutputs.flatMap((m) => m.imports);

    let data = header;

    const schemasPath = output.schemas
      ? upath.getRelativeImportPath(
          path,
          getFileInfo(
            isString(output.schemas) ? output.schemas : output.schemas.path,
            { extension: output.fileExtension },
          ).dirname,
        )
      : undefined;

    const isAllowSyntheticDefaultImports = isSyntheticDefaultImportsAllow(
      output.tsconfig,
    );

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

    // When `schemas` is unset there is no schemasPath. We must still emit imports
    // that carry `importPath` (e.g. baseUrl.runtime imports), but we must not
    // pass `'.'` for schema-relative imports: that becomes `from '.'` and breaks
    // TS (see samples with a real `schemas` path). So only `importPath` entries
    // use the `.` placeholder when `schemasPath` is missing.
    const importsForBuilder = schemasPath
      ? generateImportsForBuilder(output, normalizedImports, schemasPath)
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

    // Emit per-generator-entry mock imports. Each entry produces its own
    // import header (e.g. `from 'msw'` for msw, `from '@faker-js/faker'` for
    // faker) by passing its `options` (with discriminating `type`).
    for (const [index, mockOutput] of mockOutputs.entries()) {
      const filteredMockImports = mockOutput.imports.filter(
        (impMock) =>
          !normalizedImports.some(
            (imp) =>
              imp.name === impMock.name &&
              (imp.alias ?? '') === (impMock.alias ?? ''),
          ),
      );
      const importsMockForBuilder = schemasPath
        ? generateImportsForBuilder(output, filteredMockImports, schemasPath)
        : generateImportsForBuilder(
            output,
            filteredMockImports.filter((imp) => !!imp.importPath),
            '.',
          );
      const entry = output.mocks.generators[index];
      data += builder.importsMock({
        implementation: mockOutput.implementation,
        imports: importsMockForBuilder,
        projectName,
        hasSchemaDir: !!output.schemas,
        isAllowSyntheticDefaultImports,
        options: entry && !isFunction(entry) ? entry : undefined,
      });
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

    if (mockOutputs.length > 0) {
      data += '\n\n';
      data += implementationMock;
    }

    await writeGeneratedFile(path, data);

    return [path];
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'unknown error';
    throw new Error(
      `Oups... 🍻. An Error occurred while writing file => ${errorMsg}`,
      { cause: error },
    );
  }
}
