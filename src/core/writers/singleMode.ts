import { outputFile } from 'fs-extra';
import { join } from 'upath';
import { WriteModeProps } from '../../types/writers';
import { camel } from '../../utils/case';
import { getFileInfo } from '../../utils/file';
import { getFilesHeader } from '../../utils/messages/inline';
import { relativeSafe } from '../../utils/path';
import { generateClientImports } from '../generators/client';
import { generateMutatorImports } from '../generators/imports';
import { generateModelsInline } from '../generators/modelsInline';
import { generateMSWImports } from '../generators/msw';
import { generateTarget } from './target';

export const writeSingleMode = async ({
  workspace,
  operations,
  schemas,
  info,
  output,
  specsName,
}: WriteModeProps) => {
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
    } = generateTarget(operations, info, output);

    let data = getFilesHeader(info);

    if (output.schemas) {
      const schemasPath = relativeSafe(
        dirname,
        getFileInfo(join(workspace, output.schemas)).dirname,
      );

      data += generateClientImports(
        output.client,
        implementation,
        [{ exports: imports, dependency: schemasPath }],
        specsName,
      );
      if (output.mock) {
        data += generateMSWImports(
          implementationMSW,
          [{ exports: importsMSW, dependency: schemasPath }],
          specsName,
        );
      }
    } else {
      data += generateClientImports(
        output.client,
        implementation,
        [],
        specsName,
      );

      if (output.mock) {
        data += generateMSWImports(implementationMSW, [], specsName);
      }

      data += generateModelsInline(schemas);
    }

    if (mutators) {
      data += generateMutatorImports(mutators);
    }

    if (formData) {
      data += generateMutatorImports(formData);
    }

    data += `\n\n${implementation}`;

    if (output.mock) {
      data += '\n\n';
      data += implementationMSW;
    }

    await outputFile(path, data);
  } catch (e) {
    throw `Oups... 🍻. An Error occurred while writing file => ${e}`;
  }
};
