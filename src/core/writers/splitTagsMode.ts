import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { OutputClient, OutputOptions } from '../../types';
import { WriteSpecsProps } from '../../types/writers';
import { camel, kebab } from '../../utils/case';
import { getFileInfo } from '../../utils/file';
import { getFilesHeader } from '../../utils/messages/inline';
import { generateClientImports } from '../generators/client';
import { generateMutatorImports } from '../generators/imports';
import { generateModelsInline } from '../generators/modelsInline';
import { generateMSWImports } from '../generators/msw';
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
    { backupFilename: camel(info.title) },
  );

  if (!existsSync(dirname)) {
    mkdirSync(dirname);
  }

  const target = generateTargetForTags(operations, output);

  Object.entries(target).forEach(([tag, target]) => {
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
        resolvePath(path, getFileInfo(join(workspace, output.schemas)).dirname);

      implementationData += generateClientImports(
        output.client,
        implementation,
        [{ exports: imports, dependency: schemasPath }],
      );
      mswData += generateMSWImports(implementationMSW, [
        { exports: [...imports, ...importsMSW], dependency: schemasPath },
      ]);
    } else {
      const schemasPath = '../' + filename + '.schemas';
      const schemasData = header + generateModelsInline(schemas);

      writeFileSync(
        join(dirname, filename + '.schemas' + extension),
        schemasData,
      );

      implementationData += generateClientImports(
        output.client,
        implementation,
        [{ exports: imports, dependency: schemasPath }],
      );
      mswData += generateMSWImports(implementationMSW, [
        { exports: [...imports, ...importsMSW], dependency: schemasPath },
      ]);
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
