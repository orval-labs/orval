import fs from 'fs-extra';
import { generateModelsInline, generateMutatorImports } from '../generators';
import { WriteModeProps } from '../types';
import {
  camel,
  getFileInfo,
  isSyntheticDefaultImportsAllow,
  kebab,
  upath,
} from '../utils';
import { generateTargetForTags } from './target-tags';

export const writeTagsMode = async ({
  builder,
  output,
  specsName,
  header,
  needSchema,
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
          clientMutators,
          formData,
          formUrlEncoded,
        } = target;

        let data = header;

        const schemasPathRelative = output.schemas
          ? upath.relativeSafe(dirname, getFileInfo(output.schemas).dirname)
          : './' + filename + '.schemas';

        data += builder.imports({
          client: output.client,
          implementation,
          imports: [
            {
              exports: imports.filter(
                (imp) => !importsMSW.some((impMSW) => imp.name === impMSW.name),
              ),
              dependency: schemasPathRelative,
            },
          ],
          specsName,
          hasSchemaDir: !!output.schemas,
          isAllowSyntheticDefaultImports,
          hasGlobalMutator: !!output.override.mutator,
          packageJson: output.packageJson,
        });

        if (output.mock) {
          data += builder.importsMock({
            implementation: implementationMSW,
            imports: [{ exports: importsMSW, dependency: schemasPathRelative }],
            specsName,
            hasSchemaDir: !!output.schemas,
            isAllowSyntheticDefaultImports,
          });
        }

        const schemasPath = !output.schemas
          ? upath.join(dirname, filename + '.schemas' + extension)
          : undefined;

        if (schemasPath && needSchema) {
          const schemasData = header + generateModelsInline(builder.schemas);

          await fs.outputFile(schemasPath, schemasData);
        }

        if (mutators) {
          data += generateMutatorImports({ mutators, implementation });
        }

        if (clientMutators) {
          data += generateMutatorImports({
            mutators: clientMutators,
          });
        }

        if (formData) {
          data += generateMutatorImports({ mutators: formData });
        }

        if (formUrlEncoded) {
          data += generateMutatorImports({ mutators: formUrlEncoded });
        }

        data += '\n\n';
        data += implementation;

        if (output.mock) {
          data += '\n\n';

          data += implementationMSW;
        }

        const implementationPath = upath.join(
          dirname,
          `${kebab(tag)}${extension}`,
        );
        await fs.outputFile(implementationPath, data);

        return [implementationPath, ...(schemasPath ? [schemasPath] : [])];
      } catch (e) {
        throw `Oups... 🍻. An Error occurred while writing tag ${tag} => ${e}`;
      }
    }),
  );

  return generatedFilePathsArray.flatMap((it) => it);
};
