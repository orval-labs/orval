import path from 'node:path';

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
import { escapeRegExp } from '../utils/string';
import { writeGeneratedFile } from './file';
import { getFinalizeMockImplementationOptions } from './finalize-mock-implementation';
import { generateImportsForBuilder } from './generate-imports-for-builder';
import { collapseInlineMockOutputs } from './mock-outputs';
import { generateTargetForTags } from './target-tags';
import { getOrvalGeneratedTypes, getTypedResponse } from './types';

export async function writeTagsMode({
  builder,
  output,
  projectName,
  header,
  needSchema,
  generateSchemasInline,
}: WriteModeProps): Promise<string[]> {
  const {
    path: targetPath,
    filename,
    dirname,
    extension,
  } = getFileInfo(output.target, {
    backupFilename: conventionName(
      builder.info.title ?? 'filename',
      output.namingConvention,
    ),
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
          mockOutputs: rawMockOutputs,
          mutators,
          clientMutators,
          formData,
          formUrlEncoded,
          fetchReviver,
          paramsSerializer,
          paramsFilter,
        } = target;

        // Tags-mode inlines mock content into the per-tag implementation
        // file, so collapse duplicate factories (drop faker when msw is
        // present) before emitting.
        const mockOutputs = collapseInlineMockOutputs(rawMockOutputs);

        const importsMock = mockOutputs.flatMap((m) => m.imports);
        const implementationMock = mockOutputs
          .map((m) => m.implementation)
          .join('\n\n');
        const finalizedImplementationMock = builder.finalizeMockImplementation
          ? builder.finalizeMockImplementation(
              implementationMock,
              getFinalizeMockImplementationOptions(output, mockOutputs),
            )
          : implementationMock;

        let data = header;

        const schemasPathRelative = output.schemas
          ? upath.getRelativeImportPath(
              targetPath,
              getFileInfo(
                isString(output.schemas) ? output.schemas : output.schemas.path,
                { extension: output.fileExtension },
              ).dirname,
            )
          : './' + filename + '.schemas' + extension.replace(/\.ts$/, '');

        const implementationImports = imports.filter((imp) => {
          const searchWords = [imp.alias, imp.name]
            .filter((part): part is string => Boolean(part?.length))
            .map((part) => escapeRegExp(part))
            .join('|');
          if (!searchWords) {
            return false;
          }

          return new RegExp(String.raw`\b(${searchWords})\b`, 'g').test(
            implementation,
          );
        });

        const normalizedImports = implementationImports.map((imp) => ({
          ...imp,
        }));
        for (const mockImport of importsMock) {
          const matchingImport = normalizedImports.find(
            (imp) =>
              imp.name === mockImport.name &&
              (imp.alias ?? '') === (mockImport.alias ?? ''),
          );
          if (!matchingImport) continue;

          const mockNeedsRuntimeValue =
            !!mockImport.values ||
            !!mockImport.isConstant ||
            !!mockImport.default ||
            !!mockImport.namespaceImport ||
            !!mockImport.syntheticDefaultImport;
          if (mockNeedsRuntimeValue) {
            matchingImport.values = true;
          }
        }

        const importsForBuilder = generateImportsForBuilder(
          output,
          normalizedImports,
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

        // Emit per-generator-entry mock imports so each entry's specific
        // import header is included (msw vs faker, etc.). Match by type so
        // collapsing the mockOutputs array does not misalign indices.
        for (const mockOutput of mockOutputs) {
          const entry = output.mock.generators.find(
            (g) => !isFunction(g) && g.type === mockOutput.type,
          );
          const importsMockForBuilder = generateImportsForBuilder(
            output,
            mockOutput.imports.filter(
              (impMock) =>
                !normalizedImports.some(
                  (imp) =>
                    imp.name === impMock.name &&
                    (imp.alias ?? '') === (impMock.alias ?? ''),
                ),
            ),
            schemasPathRelative,
          );

          data += builder.importsMock({
            implementation: mockOutput.implementation,
            imports: importsMockForBuilder,
            projectName,
            hasSchemaDir: !!output.schemas,
            isAllowSyntheticDefaultImports,
            options: entry && !isFunction(entry) ? entry : undefined,
          });
        }

        const schemasPath =
          !output.schemas && needSchema
            ? path.join(dirname, filename + '.schemas' + extension)
            : undefined;

        if (schemasPath) {
          const schemasData = generateSchemasInline
            ? header + generateSchemasInline()
            : header + generateModelsInline(builder.schemas);

          await writeGeneratedFile(schemasPath, schemasData);
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

        if (paramsFilter) {
          data += generateMutatorImports({ mutators: paramsFilter });
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

        if (mockOutputs.length > 0) {
          data += '\n\n';

          data += finalizedImplementationMock;
        }

        const implementationPath = path.join(
          dirname,
          `${kebab(tag)}${extension}`,
        );
        await writeGeneratedFile(implementationPath, data);

        return [implementationPath, ...(schemasPath ? [schemasPath] : [])];
      } catch (error) {
        throw new Error(
          `Oups... 🍻. An Error occurred while writing tag ${tag} => ${String(error)}`,
          { cause: error },
        );
      }
    }),
  );

  return generatedFilePathsArray.flat();
}
