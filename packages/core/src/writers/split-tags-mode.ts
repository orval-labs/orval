import { outputFile } from 'fs-extra';
import { join } from 'upath';
import { generateModelsInline, generateMutatorImports } from '../generators';
import { OutputClient, WriteModeProps } from '../types';
import {
  camel,
  getFileInfo,
  isSyntheticDefaultImportsAllow,
  relativeSafe,
} from '../utils';
import { generateTargetForTags } from './target-tags';

export const writeSplitTagsMode = async ({
  builder,
  output,
  specsName,
  header,
}: WriteModeProps): Promise<string[]> => {
  const { filename, dirname, extension } = getFileInfo(output.target, {
    backupFilename: camel(builder.info.title),
  });

  const target = generateTargetForTags(builder, output);

  const isAllowSyntheticDefaultImports = isSyntheticDefaultImportsAllow(
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

        let implementationData = header;
        let mswData = header;

        const relativeSchemasPath = output.schemas
          ? '../' + relativeSafe(dirname, getFileInfo(output.schemas).dirname)
          : '../' + filename + '.schemas';

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
          ? join(dirname, filename + '.schemas' + extension)
          : undefined;

        if (schemasPath) {
          const schemasData = header + generateModelsInline(builder.schemas);

          await outputFile(schemasPath, schemasData);
        }

        if (mutators) {
          implementationData += generateMutatorImports({
            mutators,
            implementation,
            oneMore: true,
          });
        }

        if (formData) {
          implementationData += generateMutatorImports({
            mutators: formData,
            oneMore: true,
          });
        }
        if (formUrlEncoded) {
          implementationData += generateMutatorImports({
            mutators: formUrlEncoded,
            oneMore: true,
          });
        }

        implementationData += `\n${implementation}`;
        mswData += `\n${implementationMSW}`;

        const implementationFilename =
          tag +
          (OutputClient.ANGULAR === output.client ? '.service' : '') +
          extension;

        const implementationPath = join(dirname, tag, implementationFilename);
        await outputFile(implementationPath, implementationData);

        const mockPath = output.mock
          ? join(dirname, tag, tag + '.msw' + extension)
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

  return generatedFilePathsArray.flatMap((it) => it);
};
