import fs from 'fs-extra';

import { generateModelsInline, generateMutatorImports } from '../generators';
import { OutputClient, type WriteModeProps } from '../types';
import {
  conventionName,
  getFileInfo,
  isFunction,
  isSyntheticDefaultImportsAllow,
  upath,
} from '../utils';
import { getMockFileExtensionByTypeName } from '../utils/file-extensions';
import { generateImportsForBuilder } from './generate-imports-for-builder';
import { generateTarget } from './target';
import {
  getBrandedHelperType,
  getOrvalGeneratedTypes,
  getTypedResponse,
} from './types';

export async function writeSplitMode({
  builder,
  output,
  projectName,
  header,
  needSchema,
}: WriteModeProps): Promise<string[]> {
  try {
    const { filename, dirname, extension } = getFileInfo(output.target, {
      backupFilename: conventionName(
        builder.info.title,
        output.namingConvention,
      ),
      extension: output.fileExtension,
    });

    const {
      imports,
      implementation,
      implementationMock,
      importsMock,
      mutators,
      clientMutators,
      formData,
      formUrlEncoded,
      paramsSerializer,
      fetchReviver,
    } = generateTarget(builder, output);

    let implementationData = header;
    let mockData = header;

    const relativeSchemasPath = output.schemas
      ? upath.relativeSafe(
          dirname,
          getFileInfo(
            typeof output.schemas === 'string'
              ? output.schemas
              : output.schemas.path,
            { extension: output.fileExtension },
          ).dirname,
        )
      : './' + filename + '.schemas';

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

    const importsMockForBuilder = generateImportsForBuilder(
      output,
      importsMock,
      relativeSchemasPath,
    );

    mockData += builder.importsMock({
      implementation: implementationMock,
      imports: importsMockForBuilder,
      projectName,
      hasSchemaDir: !!output.schemas,
      isAllowSyntheticDefaultImports,
      options: isFunction(output.mock) ? undefined : output.mock,
    });

    const schemasPath = output.schemas
      ? undefined
      : upath.join(dirname, filename + '.schemas' + extension);

    if (schemasPath && needSchema) {
      let schemasData = header;

      if (builder.brandedTypes?.size) {
        schemasData += getBrandedHelperType();
        schemasData += '\n';
      }

      schemasData += generateModelsInline(builder.schemas);

      await fs.outputFile(
        upath.join(dirname, filename + '.schemas' + extension),
        schemasData,
      );
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

    if (implementation.includes('Branded<')) {
      implementationData += getBrandedHelperType();
      implementationData += '\n';
    }

    implementationData += `\n${implementation}`;

    if (implementationMock.includes('Branded<')) {
      mockData += getBrandedHelperType();
      mockData += '\n';
    }

    mockData += `\n${implementationMock}`;

    const implementationFilename =
      filename +
      (OutputClient.ANGULAR === output.client ? '.service' : '') +
      extension;

    const implementationPath = upath.join(dirname, implementationFilename);
    await fs.outputFile(
      upath.join(dirname, implementationFilename),
      implementationData,
    );

    const mockPath = output.mock
      ? upath.join(
          dirname,
          filename +
            '.' +
            getMockFileExtensionByTypeName(output.mock) +
            extension,
        )
      : undefined;

    if (mockPath) {
      await fs.outputFile(mockPath, mockData);
    }

    return [
      implementationPath,
      ...(schemasPath ? [schemasPath] : []),
      ...(mockPath ? [mockPath] : []),
    ];
  } catch (error) {
    throw new Error(
      `Oups... 🍻. An Error occurred while splitting => ${error}`,
    );
  }
}
