import { outputFile } from 'fs-extra';
import { join } from 'upath';
import { OutputClient } from '../../types';
import { WriteModeProps } from '../../types/writers';
import { camel, kebab } from '../../utils/case';
import { getFileInfo } from '../../utils/file';
import { relativeSafe } from '../../utils/path';
import { generateClientImports } from '../generators/client';
import { generateMutatorImports } from '../generators/imports';
import { generateModelsInline } from '../generators/modelsInline';
import { generateMSWImports } from '../generators/msw';
import { generateTargetForTags } from './targetTags';

export const writeSplitTagsMode = async ({
  operations,
  schemas,
  info,
  output,
  specsName,
  header,
}: WriteModeProps): Promise<string[]> => {
  const { filename, dirname, extension } = getFileInfo(output.target, {
    backupFilename: camel(info.title),
  });

  const target = generateTargetForTags(operations, output);

  const generatedFilePathsArray = await Promise.all(
    Object.entries(target).map(async ([tag, target]) => {
      try {
        const {
          imports,
          implementation,
          implementationMSW,
          importsMSW,
          mutators,
          formData,
          formUrlEncoded,
        } = target;

        let implementationData = header;
        let mswData = header;

        const relativeSchemasPath = output.schemas
          ? '../' + relativeSafe(dirname, getFileInfo(output.schemas).dirname)
          : '../' + filename + '.schemas';

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

          await outputFile(schemasPath, schemasData);
        }

        if (mutators) {
          implementationData += generateMutatorImports(mutators, true);
        }

        if (formData) {
          implementationData += generateMutatorImports(formData);
        }
        if (formUrlEncoded) {
          implementationData += generateMutatorImports(formUrlEncoded);
        }

        implementationData += `\n${implementation}`;
        mswData += `\n${implementationMSW}`;

        const implementationFilename =
          kebab(tag) +
          (OutputClient.ANGULAR === output.client ? '.service' : '') +
          extension;

        const implementationPath = join(
          dirname,
          kebab(tag),
          implementationFilename,
        );
        await outputFile(implementationPath, implementationData);

        const mockPath = output.mock
          ? join(dirname, kebab(tag), kebab(tag) + '.msw' + extension)
          : undefined;

        if (mockPath) {
          await outputFile(mockPath, mswData);
        }

        return [
          implementationPath,
          ...(schemasPath ? [schemasPath] : []),
          ...(mockPath ? [mockPath] : []),
        ];
      } catch (e) {
        throw `Oups... 🍻. An Error occurred while splitting tag ${tag} => ${e}`;
      }
    }),
  );

  return generatedFilePathsArray.reduce((acc, it) => [...acc, ...it], []);
};
