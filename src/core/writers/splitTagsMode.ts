import { outputFile } from 'fs-extra';
import { join } from 'upath';
import { OutputClient } from '../../types';
import { WriteModeProps } from '../../types/writers';
import { camel, kebab } from '../../utils/case';
import { getFileInfo } from '../../utils/file';
import { getFilesHeader } from '../../utils/messages/inline';
import { relativeSafe } from '../../utils/path';
import { generateClientImports } from '../generators/client';
import { generateMutatorImports } from '../generators/imports';
import { generateModelsInline } from '../generators/modelsInline';
import { generateMSWImports } from '../generators/msw';
import { generateTargetForTags } from './targetTags';

export const writeSplitTagsMode = ({
  operations,
  schemas,
  info,
  output,
  workspace,
  specsName,
}: WriteModeProps) => {
  const { path, filename, dirname, extension } = getFileInfo(
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

        let implementationData = header;
        let mswData = header;

        if (output.schemas) {
          const schemasPath =
            '../' +
            relativeSafe(
              dirname,
              getFileInfo(join(workspace, output.schemas)).dirname,
            );

          implementationData += generateClientImports(
            output.client,
            implementation,
            [{ exports: imports, dependency: schemasPath }],
            specsName,
          );
          mswData += generateMSWImports(
            implementationMSW,
            [{ exports: [...imports, ...importsMSW], dependency: schemasPath }],
            specsName,
          );
        } else {
          const schemasPath = '../' + filename + '.schemas';
          const schemasData = header + generateModelsInline(schemas);

          await outputFile(
            join(dirname, filename + '.schemas' + extension),
            schemasData,
          );

          implementationData += generateClientImports(
            output.client,
            implementation,
            [{ exports: imports, dependency: schemasPath }],
            specsName,
          );
          mswData += generateMSWImports(
            implementationMSW,
            [{ exports: [...imports, ...importsMSW], dependency: schemasPath }],
            specsName,
          );
        }

        if (mutators) {
          implementationData += generateMutatorImports(mutators, true);
        }

        implementationData += `\n${implementation}`;
        mswData += `\n${implementationMSW}`;

        if (path) {
          const implementationFilename =
            kebab(tag) +
            (OutputClient.ANGULAR === output.client ? '.service' : '') +
            extension;

          await outputFile(
            join(dirname, kebab(tag), implementationFilename),
            implementationData,
          );

          if (output.mock) {
            await outputFile(
              join(dirname, kebab(tag), kebab(tag) + '.msw' + extension),
              mswData,
            );
          }
        }
      } catch (e) {
        throw `Oups... 🍻. An Error occurred while splitting tag ${tag} => ${e}`;
      }
    }),
  );
};
