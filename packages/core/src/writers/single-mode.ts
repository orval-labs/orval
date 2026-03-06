import fs from 'fs-extra';

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
import { generateImportsForBuilder } from './generate-imports-for-builder';
import { generateTarget } from './target';
import { getOrvalGeneratedTypes, getTypedResponse } from './types';

export async function writeSingleMode({
  builder,
  output,
  projectName,
  header,
  needSchema,
}: WriteModeProps): Promise<string[]> {
  try {
    const { path } = getFileInfo(output.target, {
      backupFilename: conventionName(
        builder.info.title,
        output.namingConvention,
      ),
      extension: output.fileExtension,
    });

    const {
      imports,
      importsMock,
      implementation,
      implementationMock,
      mutators,
      clientMutators,
      formData,
      formUrlEncoded,
      paramsSerializer,
      fetchReviver,
    } = generateTarget(builder, output);

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

    const importsForBuilder = schemasPath
      ? generateImportsForBuilder(output, normalizedImports, schemasPath)
      : [];

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

    if (output.mock) {
      const importsMockForBuilder = schemasPath
        ? generateImportsForBuilder(
            output,
            importsMock.filter(
              (impMock) =>
                !normalizedImports.some(
                  (imp) =>
                    imp.name === impMock.name &&
                    (imp.alias ?? '') === (impMock.alias ?? ''),
                ),
            ),
            schemasPath,
          )
        : [];
      data += builder.importsMock({
        implementation: implementationMock,
        imports: importsMockForBuilder,
        projectName,
        hasSchemaDir: !!output.schemas,
        isAllowSyntheticDefaultImports,
        options: isFunction(output.mock) ? undefined : output.mock,
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
      data += generateModelsInline(builder.schemas);
    }

    data += `${implementation.trim()}\n`;

    if (output.mock) {
      data += '\n\n';
      data += implementationMock;
    }

    await fs.outputFile(path, data);

    return [path];
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'unknown error';
    throw new Error(
      `Oups... 🍻. An Error occurred while writing file => ${errorMsg}`,
      { cause: error },
    );
  }
}
