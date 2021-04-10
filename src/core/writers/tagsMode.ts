import { outputFile } from 'fs-extra';
import { join, relative } from 'upath';
import { WriteModeProps } from '../../types/writers';
import { camel, kebab } from '../../utils/case';
import { getFileInfo } from '../../utils/file';
import { isObject } from '../../utils/is';
import { getFilesHeader } from '../../utils/messages/inline';
import { generateClientImports } from '../generators/client';
import { generateMutatorImports } from '../generators/imports';
import { generateModelsInline } from '../generators/modelsInline';
import { generateMSWImports } from '../generators/msw';
import { generateTargetForTags } from './targetTags';

export const writeTagsMode = ({
  operations,
  schemas,
  info,
  output,
  workspace,
  specsName,
}: WriteModeProps) => {
  const { filename, dirname, extension } = getFileInfo(
    join(workspace, output.target || ''),
    { backupFilename: camel(info.title) },
  );

  const target = generateTargetForTags(operations, output);

  return Promise.all(
    Object.entries(target).map(async ([tag, target]) => {
      try {
        const {
          imports,
          implementation,
          implementationMSW,
          importsMSW,
          mutators,
        } = target;
        const header = getFilesHeader(info);
        let data = header;

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
          const schemasPath = './' + filename + '.schemas';
          const schemasData = header + generateModelsInline(schemas);

          await outputFile(
            join(dirname, filename + '.schemas' + extension),
            schemasData,
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
        }

        if (mutators) {
          data += generateMutatorImports(mutators);
        }

        data += '\n\n';
        data += implementation;

        if (isObject(output) && output.mock) {
          data += '\n\n';

          data += implementationMSW;
        }

        await outputFile(join(dirname, `${kebab(tag)}${extension}`), data);
      } catch (e) {
        throw `Oups... 🍻. An Error occurred while writing tag ${tag} => ${e}`;
      }
    }),
  );
};
