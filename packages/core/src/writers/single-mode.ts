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
import { generateImportsForBuilder } from './generate-imports-for-builder';
import { generateTarget } from './target';
import { getOrvalGeneratedTypes, getTypedResponse } from './types';

export const writeSingleMode = async ({
  builder,
  output,
  specsName,
  header,
  needSchema,
}: WriteModeProps): Promise<string[]> => {
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
          getFileInfo(output.schemas, { extension: output.fileExtension })
            .dirname,
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
      specsName,
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
        specsName,
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

    // Don't generate TypeScript schemas for react-query-zod as we use zod types instead
    if (!output.schemas && needSchema && output.client !== OutputClient.REACT_QUERY_ZOD) {
      data += generateModelsInline(builder.schemas);
    }

    // Add zod imports if needed (for react-query-zod client)
    // Collect unique zod import statements from all operations
    const zodImportStatements = new Set<string>();
    Object.values(builder.operations).forEach((op: any) => {
      if (op.__zodImportStatement) {
        zodImportStatements.add(op.__zodImportStatement);
      }
    });
    
    // For react-query-zod, we use exported types from zod files, not z.infer
    // So we don't need to import 'z' from 'zod'
    if (zodImportStatements.size > 0) {
      data += Array.from(zodImportStatements).join('');
    }

    data += `${implementation.trim()}\n`;

    if (output.mock) {
      data += '\n\n';
      data += implementationMock;
    }

    await fs.outputFile(path, data);

    return [path];
  } catch (error) {
    throw new Error(
      `Oups... 🍻. An Error occurred while writing file => ${error}`,
    );
  }
};
