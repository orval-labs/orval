import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { OutputOptions } from '../../types';
import { WriteSpecsProps } from '../../types/writers';
import { camel, kebab } from '../../utils/case';
import { getFileInfo } from '../../utils/file';
import { isObject } from '../../utils/is';
import { getFilesHeader } from '../../utils/messages/inline';
import { errorMessage } from '../../utils/messages/logs';
import { generateClientImports } from '../generators/client';
import { generateImports } from '../generators/imports';
import { generateModelsInline } from '../generators/modelsInline';
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
    camel(info.title),
  );

  if (!existsSync(dirname)) {
    mkdirSync(dirname);
  }

  const target = generateTargetForTags(operations, info, output);

  Object.entries(target).forEach(([tag, target]) => {
    const {
      definition,
      imports,
      importsMocks,
      implementation,
      implementationMocks,
      implementationMSW,
    } = target;
    const header = getFilesHeader(info);
    const defaultImports = generateClientImports(output.client);
    let data = header;

    if (isObject(output) && output.mock) {
      if (output.mock === 'old-version') {
        data += defaultImports.implementationMock;
      } else {
        data += defaultImports.implementation;
        data += defaultImports.implementationMSW;
      }
    } else {
      data += defaultImports.implementation;
    }

    if (isObject(output) && output.schemas) {
      const schemasPath = resolvePath(
        path,
        getFileInfo(join(workspace, output.schemas)).dirname,
      );
      data += generateImports([...imports, ...importsMocks], schemasPath, true);
    } else {
      const schemasPath = './' + filename + '.schemas';
      const schemasData = header + generateModelsInline(schemas);

      writeFileSync(
        join(dirname, filename + '.schemas' + extension),
        schemasData,
      );

      data += generateImports([...imports, ...importsMocks], schemasPath, true);
    }

    data += '\n';
    data += definition;
    data += '\n\n';
    data += implementation;

    if (isObject(output) && output.mock) {
      data += '\n\n';
      if (output.mock === 'old-version') {
        errorMessage(
          'This way of using mocks is deprecated. Will be removed in the next major release',
        );
        data += implementationMocks;
      } else {
        data += implementationMSW;
      }
    }

    writeFileSync(join(dirname, `${kebab(tag)}${extension}`), data);
  });
};
