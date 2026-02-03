import fs from 'fs-extra';

import { generateModelsInline, generateMutatorImports } from '../generators';
import type { WriteModeProps } from '../types';
import {
  conventionName,
  getFileInfo,
  isFunction,
  isSyntheticDefaultImportsAllow,
  upath,
} from '../utils';
import { generateImportsForBuilder } from './generate-imports-for-builder';
import { generateTarget } from './target';
import {
  getBrandedHelperType,
  getOrvalGeneratedTypes,
  getTypedResponse,
} from './types';

export async function writeSingleMode({
  builder,
  output,
  projectName,
  header,
  needSchema,
}: WriteModeProps): Promise<string[]> {
  try {
    const { path, dirname } = getFileInfo(output.target, {
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
      ? upath.relativeSafe(
          dirname,
          getFileInfo(
            typeof output.schemas === 'string'
              ? output.schemas
              : output.schemas.path,
            { extension: output.fileExtension },
          ).dirname,
        )
      : undefined;

    const isAllowSyntheticDefaultImports = isSyntheticDefaultImportsAllow(
      output.tsconfig,
    );

    const importsForBuilder = schemasPath
      ? generateImportsForBuilder(
          output,
          imports.filter(
            (imp) => !importsMock.some((impMock) => imp.name === impMock.name),
          ),
          schemasPath,
        )
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
        ? generateImportsForBuilder(output, importsMock, schemasPath)
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

    if (
      implementation.includes('Branded<') ||
      implementationMock.includes('Branded<')
    ) {
      data += getBrandedHelperType();
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
    );
  }
}
