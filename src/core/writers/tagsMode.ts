import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { OutputOptions } from '../../types';
import { WriteSpecsProps } from '../../types/writers';
import { camel, kebab } from '../../utils/case';
import { getFileInfo } from '../../utils/file';
import { isObject } from '../../utils/is';
import { getFilesHeader } from '../../utils/messages/inline';
import { generateClientImports } from '../generators/client';
import { generateMutatorImports } from '../generators/imports';
import { generateModelsInline } from '../generators/modelsInline';
import { generateMSWImports } from '../generators/msw';
import { resolvePath } from '../resolvers/path';
import { generateTargetForTags } from './targetTags';

export const writeTagsMode = ({
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
    let data = header;

    if (isObject(output) && output.schemas) {
      const schemasPath = resolvePath(
        path,
        getFileInfo(join(workspace, output.schemas)).dirname,
      );

      data += generateClientImports(output.client, implementation, [
        { exports: imports, dependency: schemasPath },
      ]);
      if (output.mock) {
        data += generateMSWImports(implementationMSW, [
          { exports: importsMSW, dependency: schemasPath },
        ]);
      }
    } else {
      const schemasPath = './' + filename + '.schemas';
      const schemasData = header + generateModelsInline(schemas);

      writeFileSync(
        join(dirname, filename + '.schemas' + extension),
        schemasData,
      );

      data += generateClientImports(output.client, implementation, [
        { exports: imports, dependency: schemasPath },
      ]);
      if (output.mock) {
        data += generateMSWImports(implementationMSW, [
          { exports: importsMSW, dependency: schemasPath },
        ]);
      }
    }

    if (mutators) {
      data += generateMutatorImports(mutators);
    }

    data += '\n\n';
    data += implementation;

    if (isObject(output) && output.mock) {
      data += '\n\n';

      data += implementationMSW;
    }

    writeFileSync(join(dirname, `${kebab(tag)}${extension}`), data);
  });
};
