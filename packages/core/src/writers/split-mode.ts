import fs from 'fs-extra';
import path from 'path';
import { generateModelsInline, generateMutatorImports } from '../generators';
import { OutputClient, WriteModeProps } from '../types';
import {
  camel,
  getFileInfo,
  isSyntheticDefaultImportsAllow,
  relativeSafe,
} from '../utils';
import { generateTarget } from './target';

export const writeSplitMode = async ({
  builder,
  output,
  specsName,
  header,
}: WriteModeProps): Promise<string[]> => {
  try {
    const { filename, dirname, extension } = getFileInfo(output.target, {
      backupFilename: camel(builder.info.title),
    });

    const {
      imports,
      implementation,
      implementationMSW,
      importsMSW,
      mutators,
      clientMutators,
      formData,
      formUrlEncoded,
    } = generateTarget(builder, output);

    let implementationData = header;
    let mswData = header;

    const relativeSchemasPath = output.schemas
      ? relativeSafe(dirname, getFileInfo(output.schemas).dirname)
      : './' + filename + '.schemas';

    const isAllowSyntheticDefaultImports = isSyntheticDefaultImportsAllow(
      output.tsconfig,
    );

    implementationData += builder.imports({
      client: output.client,
      implementation,
      imports: [{ exports: imports, dependency: relativeSchemasPath }],
      specsName,
      hasSchemaDir: !!output.schemas,
      isAllowSyntheticDefaultImports,
      hasGlobalMutator: !!output.override.mutator,
      packageJson: output.packageJson,
    });
    mswData += builder.importsMock({
      implementation: implementationMSW,
      imports: [
        {
          exports: importsMSW,
          dependency: relativeSchemasPath,
        },
      ],
      specsName,
      hasSchemaDir: !!output.schemas,
      isAllowSyntheticDefaultImports,
    });

    const schemasPath = !output.schemas
      ? path.join(dirname, filename + '.schemas' + extension)
      : undefined;

    if (schemasPath) {
      const schemasData = header + generateModelsInline(builder.schemas);

      await fs.outputFile(
        path.join(dirname, filename + '.schemas' + extension),
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

    implementationData += `\n${implementation}`;
    mswData += `\n${implementationMSW}`;

    const implementationFilename =
      filename +
      (OutputClient.ANGULAR === output.client ? '.service' : '') +
      extension;

    const implementationPath = path.join(dirname, implementationFilename);
    await fs.outputFile(
      path.join(dirname, implementationFilename),
      implementationData,
    );

    const mockPath = output.mock
      ? path.join(dirname, filename + '.msw' + extension)
      : undefined;

    if (mockPath) {
      await fs.outputFile(mockPath, mswData);
    }

    return [
      implementationPath,
      ...(schemasPath ? [schemasPath] : []),
      ...(mockPath ? [mockPath] : []),
    ];
  } catch (e) {
    throw `Oups... 🍻. An Error occurred while splitting => ${e}`;
  }
};
