import { outputFile } from 'fs-extra';
import { join } from 'upath';
import { WriteModeProps } from '../../types/writers';
import { camel, kebab } from '../../utils/case';
import { getFileInfo } from '../../utils/file';
import { relativeSafe } from '../../utils/path';
import { isSyntheticDefaultImportsAllow } from '../../utils/tsconfig';
import { generateClientImports } from '../generators/client';
import { generateMutatorImports } from '../generators/imports';
import { generateModelsInline } from '../generators/modelsInline';
import { generateMSWImports } from '../generators/msw';
import { generateTargetForTags } from './targetTags';

export const writeTagsMode = async ({
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

  const isSyntheticDefaultImportsAllowed = isSyntheticDefaultImportsAllow(
    output.tsconfig,
  );

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

        let data = header;

        const schemasPathRelative = output.schemas
          ? relativeSafe(dirname, getFileInfo(output.schemas).dirname)
          : './' + filename + '.schemas';

        data += generateClientImports(
          output.client,
          implementation,
          [{ exports: imports, dependency: schemasPathRelative }],
          specsName,
          !!output.schemas,
          isSyntheticDefaultImportsAllowed,
        );

        if (output.mock) {
          data += generateMSWImports(
            implementationMSW,
            [{ exports: importsMSW, dependency: schemasPathRelative }],
            specsName,
            !!output.schemas,
            isSyntheticDefaultImportsAllowed,
          );
        }

        const schemasPath = !output.schemas
          ? join(dirname, filename + '.schemas' + extension)
          : undefined;

        if (schemasPath) {
          const schemasData = header + generateModelsInline(schemas);

          await outputFile(schemasPath, schemasData);
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

        data += '\n\n';
        data += implementation;

        if (output.mock) {
          data += '\n\n';

          data += implementationMSW;
        }

        const implementationPath = join(dirname, `${kebab(tag)}${extension}`);
        await outputFile(implementationPath, data);

        return [implementationPath, ...(schemasPath ? [schemasPath] : [])];
      } catch (e) {
        throw `Oups... 🍻. An Error occurred while writing tag ${tag} => ${e}`;
      }
    }),
  );

  return generatedFilePathsArray.reduce((acc, it) => [...acc, ...it], []);
};
