import { outputFile } from 'fs-extra';
import { join, relative } from 'upath';
import { WriteModeProps } from '../../types/writers';
import { camel } from '../../utils/case';
import { getFileInfo } from '../../utils/file';
import { isObject, isString } from '../../utils/is';
import { getFilesHeader } from '../../utils/messages/inline';
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
    const targetedPath = isString(output) ? output : output.target || '';
    const { path, dirname } = getFileInfo(join(workspace, targetedPath), {
      backupFilename: camel(info.title),
    });

    const {
      imports,
      importsMSW,
      implementation,
      implementationMSW,
      mutators,
    } = generateTarget(operations, info, isObject(output) ? output : undefined);

    let data = getFilesHeader(info);

    if (isObject(output) && output.schemas) {
      const schemasPath = relative(
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
        isObject(output) ? output.client : undefined,
        implementation,
        [],
        specsName,
      );

      if (isObject(output) && output.mock) {
        data += generateMSWImports(implementationMSW, [], specsName);
      }

      data += generateModelsInline(schemas);
    }

    if (mutators) {
      data += generateMutatorImports(mutators);
    }

    data += `\n\n${implementation}`;

    if (isObject(output) && output.mock) {
      data += '\n\n';
      data += implementationMSW;
    }

    await outputFile(path, data);
  } catch (e) {
    throw `Oups... 🍻. An Error occurred while writing file => ${e}`;
  }
};
