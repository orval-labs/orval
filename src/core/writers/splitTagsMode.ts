import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { OutputClient, OutputOptions } from '../../types';
import { WriteSpecsProps } from '../../types/writers';
import { camel, kebab } from '../../utils/case';
import { getFileInfo } from '../../utils/file';
import { getFilesHeader } from '../../utils/messages/inline';
import { generateClientImports } from '../generators/client';
import { generateImports, generateMutatorImports } from '../generators/imports';
import { generateModelsInline } from '../generators/modelsInline';
import { resolvePath } from '../resolvers/path';
import { generateTargetForTags } from './targetTags';

export const writeSplitTagsMode = ({
  operations,
  schemas,
  info,
  output,
  workspace,
}: WriteSpecsProps & { workspace: string; output: OutputOptions }) => {
  const { path, filename, dirname, extension } = getFileInfo(
    join(workspace, output.target || ''),
    camel(info.title),
  );

  if (!existsSync(dirname)) {
    mkdirSync(dirname);
  }

  const target = generateTargetForTags(operations, info, output);

  Object.entries(target).forEach(([tag, target]) => {
    const {
      imports,
      importsMSW,
      implementation,
      implementationMSW,
      mutators,
    } = target;
    const header = getFilesHeader(info);

    let implementationData = header;
    let mswData = header;

    const defaultImports = generateClientImports(output);

    implementationData += `${defaultImports.implementation}`;
    mswData += `${defaultImports.implementationMSW}`;

    if (output.schemas) {
      const schemasPath =
        '../' +
        resolvePath(path, getFileInfo(join(workspace, output.schemas)).dirname);

      const generatedImports = generateImports(imports, schemasPath, true);
      const generatedImportsMSW = generateImports(
        [...imports, ...importsMSW],
        schemasPath,
        true,
      );
      implementationData += generatedImports;
      mswData += generatedImportsMSW;
    } else {
      const schemasPath = '../' + filename + '.schemas';
      const schemasData = header + generateModelsInline(schemas);

      writeFileSync(
        join(dirname, filename + '.schemas' + extension),
        schemasData,
      );

      const generatedImports = generateImports(imports, schemasPath, true);
      const generatedImportsMSW = generateImports(
        [...imports, ...importsMSW],
        schemasPath,
        true,
      );
      implementationData += generatedImports;
      mswData += generatedImportsMSW;
    }

    if (mutators) {
      implementationData += generateMutatorImports(mutators, true);
    }

    implementationData += `\n${implementation}`;
    mswData += `\n${implementationMSW}`;

    if (path) {
      if (!existsSync(join(dirname, kebab(tag)))) {
        mkdirSync(join(dirname, kebab(tag)));
      }

      const implementationFilename =
        kebab(tag) +
        (OutputClient.ANGULAR === output.client ? '.service' : '') +
        extension;

      writeFileSync(
        join(dirname, kebab(tag), implementationFilename),
        implementationData,
      );

      if (output.mock) {
        writeFileSync(
          join(dirname, kebab(tag), kebab(tag) + '.msw' + extension),
          mswData,
        );
      }
    }
  });
};
