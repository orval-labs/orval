import { outputFile } from 'fs-extra';
import { join } from 'upath';
import { OutputClient } from '../../types';
import { WriteModeProps } from '../../types/writers';
import { camel } from '../../utils/case';
import { getFileInfo } from '../../utils/file';
import { relativeSafe } from '../../utils/path';
import { generateClientImports } from '../generators/client';
import { generateMutatorImports } from '../generators/imports';
import { generateModelsInline } from '../generators/modelsInline';
import { generateMSWImports } from '../generators/msw';
import { generateTarget } from './target';

export const writeSplitMode = async ({
  operations,
  schemas,
  info,
  output,
  specsName,
  header,
}: WriteModeProps): Promise<string[]> => {
  try {
    const { filename, dirname, extension } = getFileInfo(output.target, {
      backupFilename: camel(info.title),
    });

    const {
      imports,
      implementation,
      implementationMSW,
      importsMSW,
      mutators,
      formData,
    } = generateTarget(operations, info, output);

    let implementationData = header;
    let mswData = header;

    const relativeSchemasPath = output.schemas
      ? relativeSafe(dirname, getFileInfo(output.schemas).dirname)
      : './' + filename + '.schemas';

    implementationData += generateClientImports(
      output.client,
      implementation,
      [{ exports: imports, dependency: relativeSchemasPath }],
      specsName,
      !!output.schemas,
    );
    mswData += generateMSWImports(
      implementationMSW,
      [
        {
          exports: [...imports, ...importsMSW],
          dependency: relativeSchemasPath,
        },
      ],
      specsName,
      !!output.schemas,
    );

    const schemasPath = !output.schemas
      ? join(dirname, filename + '.schemas' + extension)
      : undefined;

    if (schemasPath) {
      const schemasData = header + generateModelsInline(schemas);

      await outputFile(
        join(dirname, filename + '.schemas' + extension),
        schemasData,
      );
    }

    if (mutators) {
      implementationData += generateMutatorImports(mutators);
    }

    if (formData) {
      implementationData += generateMutatorImports(formData);
    }

    implementationData += `\n${implementation}`;
    mswData += `\n${implementationMSW}`;

    const implementationFilename =
      filename +
      (OutputClient.ANGULAR === output.client ? '.service' : '') +
      extension;

    const implementationPath = join(dirname, implementationFilename);
    await outputFile(join(dirname, implementationFilename), implementationData);

    if (output.mock) {
      await outputFile(join(dirname, filename + '.msw' + extension), mswData);
    }

    return [implementationPath, ...(schemasPath ? [schemasPath] : [])];
  } catch (e) {
    throw `Oups... 🍻. An Error occurred while splitting => ${e}`;
  }
};
