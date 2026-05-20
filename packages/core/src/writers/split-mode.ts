import path from 'node:path';

import { generateModelsInline, generateMutatorImports } from '../generators';
import { OutputClient, type WriteModeProps } from '../types';
import {
  conventionName,
  getFileInfo,
  isFunction,
  isString,
  isSyntheticDefaultImportsAllow,
  upath,
} from '../utils';
import { getMockFileExtensionByTypeName } from '../utils/file-extensions';
import { writeGeneratedFile } from './file';
import { generateImportsForBuilder } from './generate-imports-for-builder';
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

    const relativeSchemasPath = output.schemas
      ? upath.getRelativeImportPath(
          targetPath,
          getFileInfo(
            isString(output.schemas) ? output.schemas : output.schemas.path,
            { extension: output.fileExtension },
          ).dirname,
        )
      : './' + filename + '.schemas' + extension.replace(/\.ts$/, '');

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

    // Emit one mock file per configured generator entry. The output filename
    // suffix comes from `getMockFileExtensionByTypeName(entry)` (e.g. `.msw.ts`
    // or `.faker.ts`).
    const mockPaths: string[] = [];
    for (const [index, mockOutput] of mockOutputs.entries()) {
      const entry = output.mocks.generators[index];
      if (!entry) continue;
      const importsMockForBuilder = generateImportsForBuilder(
        output,
        mockOutput.imports,
        relativeSchemasPath,
      );
      let mockData = header;
      mockData += builder.importsMock({
        implementation: mockOutput.implementation,
        imports: importsMockForBuilder,
        projectName,
        hasSchemaDir: !!output.schemas,
        isAllowSyntheticDefaultImports,
        options: isFunction(entry) ? undefined : entry,
      });
      mockData += `\n${mockOutput.implementation}`;

      const mockPath = path.join(
        dirname,
        filename + '.' + getMockFileExtensionByTypeName(entry) + extension,
      );
      await writeGeneratedFile(mockPath, mockData);
      mockPaths.push(mockPath);
    }

    return [
      implementationPath,
      ...(schemasPath ? [schemasPath] : []),
      ...mockPaths,
    ];
  } catch (error) {
    throw new Error(
      `Oups... 🍻. An Error occurred while splitting => ${String(error)}`,
      { cause: error },
    );
  }
}
