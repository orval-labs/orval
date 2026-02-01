import fs from 'fs-extra';

import { generateModelsInline, generateMutatorImports } from '../generators';
import type { WriteModeProps } from '../types';
import {
  conventionName,
  getFileInfo,
  isFunction,
  isString,
  isSyntheticDefaultImportsAllow,
  kebab,
  upath,
} from '../utils';
import { generateImportsForBuilder } from './generate-imports-for-builder';
import { generateTargetForTags } from './target-tags';
import { getOrvalGeneratedTypes, getTypedResponse } from './types';

export async function writeTagsMode({
  builder,
  output,
  projectName,
  header,
  needSchema,
}: WriteModeProps): Promise<string[]> {
  const { filename, dirname, extension } = getFileInfo(output.target, {
    backupFilename: conventionName(builder.info.title, output.namingConvention),
    extension: output.fileExtension,
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
          implementationMock,
          importsMock,
          mutators,
          clientMutators,
          formData,
          formUrlEncoded,
          fetchReviver,
          paramsSerializer,
        } = target;

        let data = header;

        const schemasPathRelative = output.schemas
          ? upath.relativeSafe(
              dirname,
              getFileInfo(
                isString(output.schemas)
                  ? output.schemas
                  : output.schemas.path,
                { extension: output.fileExtension },
              ).dirname,
            )
          : './' + filename + '.schemas';

        const importsForBuilder = generateImportsForBuilder(
          output,
          imports.filter(
            (imp) => !importsMock.some((impMock) => imp.name === impMock.name),
          ),
          schemasPathRelative,
        );

        data += builder.imports({
          client: output.client,
          implementation,
          imports: importsForBuilder,
          projectName,
          hasSchemaDir: !!output.schemas,
          isAllowSyntheticDefaultImports,
          hasGlobalMutator: !!output.override.mutator,
          hasTagsMutator: Object.values(output.override.tags).some(
            (tag) => !!tag?.mutator,
          ),
          hasParamsSerializerOptions: !!output.override.paramsSerializerOptions,
          packageJson: output.packageJson,
          output,
        });

        if (output.mock) {
          const importsMockForBuilder = generateImportsForBuilder(
            output,
            importsMock,
            schemasPathRelative,
          );

          data += builder.importsMock({
            implementation: implementationMock,
            imports: importsMockForBuilder,
            projectName,
            hasSchemaDir: !!output.schemas,
            isAllowSyntheticDefaultImports,
            options: isFunction(output.mock) ? undefined : output.mock,
          });
        }

        const schemasPath = output.schemas
          ? undefined
          : upath.join(dirname, filename + '.schemas' + extension);

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

        if (paramsSerializer) {
          data += generateMutatorImports({ mutators: paramsSerializer });
        }

        if (fetchReviver) {
          data += generateMutatorImports({ mutators: fetchReviver });
        }

        data += '\n\n';

        if (implementation.includes('NonReadonly<')) {
          data += getOrvalGeneratedTypes();
          data += '\n';
        }

        if (implementation.includes('TypedResponse<')) {
          data += getTypedResponse();
          data += '\n';
        }

        data += implementation;

        if (output.mock) {
          data += '\n\n';

          data += implementationMock;
        }

        const implementationPath = upath.join(
          dirname,
          `${kebab(tag)}${extension}`,
        );
        await fs.outputFile(implementationPath, data);

        return [implementationPath, ...(schemasPath ? [schemasPath] : [])];
      } catch (error) {
        throw new Error(
          `Oups... 🍻. An Error occurred while writing tag ${tag} => ${error}`,
        );
      }
    }),
  );

  return generatedFilePathsArray.flat();
}
