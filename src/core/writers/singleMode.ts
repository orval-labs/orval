import { outputFile } from 'fs-extra';
import { WriteModeProps } from '../../types/writers';
import { camel } from '../../utils/case';
import { getFileInfo } from '../../utils/file';
import { relativeSafe } from '../../utils/path';
import { generateClientImports } from '../generators/client';
import { generateMutatorImports } from '../generators/imports';
import { generateModelsInline } from '../generators/modelsInline';
import { generateMSWImports } from '../generators/msw';
import { generateTarget } from './target';

export const writeSingleMode = async ({
  operations,
  schemas,
  info,
  output,
  specsName,
  header,
}: WriteModeProps): Promise<string[]> => {
  try {
    const { path, dirname } = getFileInfo(output.target, {
      backupFilename: camel(info.title),
    });

    const {
      imports,
      importsMSW,
      implementation,
      implementationMSW,
      mutators,
      formData,
      formUrlEncoded,
    } = generateTarget(operations, info, output);

    let data = header;

    const schemasPath = output.schemas
      ? relativeSafe(dirname, getFileInfo(output.schemas).dirname)
      : undefined;

    data += generateClientImports(
      output.client,
      implementation,
      schemasPath ? [{ exports: imports, dependency: schemasPath }] : [],
      specsName,
      !!output.schemas,
    );

    if (output.mock) {
      data += generateMSWImports(
        implementationMSW,
        schemasPath ? [{ exports: importsMSW, dependency: schemasPath }] : [],
        specsName,
        !!output.schemas,
      );
    }

    if (!output.schemas) {
      data += generateModelsInline(schemas);
    }

    if (mutators) {
      data += generateMutatorImports(mutators);
    }

    if (formData) {
      data += generateMutatorImports(formData);
    }

    if (formUrlEncoded) {
      data += generateMutatorImports(formUrlEncoded);
    }

    data += `\n\n${implementation}`;

    if (output.mock) {
      data += '\n\n';
      data += implementationMSW;
    }

    await outputFile(path, data);

    return [path];
  } catch (e) {
    throw `Oups... 🍻. An Error occurred while writing file => ${e}`;
  }
};
