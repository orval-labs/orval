import fs from 'fs-extra';
import { generateModelsInline, generateMutatorImports } from '../generators';
import { GeneratorTarget, WriteModeProps } from '../types';
import {
  camel,
  getFileInfo,
  isFunction,
  isSyntheticDefaultImportsAllow,
  kebab,
  upath,
} from '../utils';
import { generateImportsForBuilder } from './generate-imports-for-builder';
import { generateTargetForOperations } from './target-operations';
import { getOrvalGeneratedTypes } from './types';

export const writeTagsOperationsMode = async ({
  builder,
  output,
  specsName,
  header,
  needSchema,
}: WriteModeProps): Promise<string[]> => {
  const { filename, dirname, extension } = getFileInfo(output.target, {
    backupFilename: camel(builder.info.title),
    extension: output.fileExtension,
  });

  const target = generateTargetForOperations(builder, output);

  const isAllowSyntheticDefaultImports = isSyntheticDefaultImportsAllow(
    output.tsconfig,
  );

  const generatedFilePathsArray = await Promise.all(
    Object.entries(target).flatMap(async ([tag, operations]) => {
      const indexFilePath = upath.join(dirname, tag, 'index' + extension);
      if (output.indexFiles) {
        await fs.outputFile(indexFilePath, '');
      }
      return await Promise.all(
        Object.entries(operations).map(async ([operation, target]) => {
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
              paramsSerializer,
            } = target;

            let data = header;

            const schemasPathRelative = output.schemas
              ? '../' +
                upath.relativeSafe(
                  dirname,
                  getFileInfo(output.schemas, {
                    extension: output.fileExtension,
                  }).dirname,
                )
              : '../' + filename + '.schemas';

            const importsForBuilder = generateImportsForBuilder(
              output,
              imports.filter(
                (imp) =>
                  !importsMock.some((impMock) => imp.name === impMock.name),
              ),
              schemasPathRelative,
            );

            data += builder.imports({
              client: output.client,
              implementation,
              imports: importsForBuilder,
              specsName,
              hasSchemaDir: !!output.schemas,
              isAllowSyntheticDefaultImports,
              hasGlobalMutator: !!output.override.mutator,
              hasTagsMutator: Object.values(output.override.tags).some(
                (tag) => !!tag.mutator,
              ),
              hasParamsSerializerOptions:
                !!output.override.paramsSerializerOptions,
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
                specsName,
                hasSchemaDir: !!output.schemas,
                isAllowSyntheticDefaultImports,
                options: !isFunction(output.mock) ? output.mock : undefined,
              });
            }

            const schemasPath = !output.schemas
              ? upath.join(dirname, filename + '.schemas' + extension)
              : undefined;

            if (schemasPath && needSchema) {
              const schemasData =
                header + generateModelsInline(builder.schemas);

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

            data += '\n\n';

            if (implementation.includes('NonReadonly<')) {
              data += getOrvalGeneratedTypes();
              data += '\n';
            }

            data += implementation;

            if (output.mock) {
              data += '\n\n';

              data += implementationMock;
            }

            const implementationPath = upath.join(
              dirname,
              tag,
              `${kebab(operation)}${extension}`,
            );
            await fs.outputFile(implementationPath, data);

            if (output.indexFiles) {
              await fs.appendFile(
                indexFilePath,
                `export * from '${upath.joinSafe('./', kebab(operation))}'\n`,
              );
            }
            return [implementationPath, ...(schemasPath ? [schemasPath] : [])];
          } catch (e) {
            throw `Oups... 🍻. An Error occurred while writing operation ${operation} => ${e}`;
          }
        }),
      );
    }),
  );

  return generatedFilePathsArray.flatMap((it) => it).flatMap((it) => it);
};
