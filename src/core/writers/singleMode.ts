import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { OutputOptions } from '../../types';
import { WriteSpecsProps } from '../../types/writers';
import { camel } from '../../utils/case';
import { getFileInfo } from '../../utils/file';
import { isObject, isString } from '../../utils/is';
import { getFilesHeader } from '../../utils/messages/inline';
import { generateClientImports } from '../generators/client';
import { generateImports } from '../generators/imports';
import { generateModelsInline } from '../generators/modelsInline';
import { generateTarget } from './target';
import { resolvePath } from '../resolvers/path';

export const writeSingleMode = ({
  workspace,
  operations,
  schemas,
  info,
  output,
}: WriteSpecsProps & { workspace: string; output: string | OutputOptions }) => {
  const targetedPath = isString(output) ? output : output.target || '';
  const { path, dirname } = getFileInfo(
    join(workspace, targetedPath),
    camel(info.title),
  );

  if (!existsSync(dirname)) {
    mkdirSync(dirname);
  }

  const {
    definition,
    imports,
    implementation,
    implementationMocks,
    implementationMSW,
  } = generateTarget(
    operations,
    info,
    isObject(output) ? output.client : undefined,
  );

  let data = getFilesHeader(info);

  const defaultImports = generateClientImports(
    isObject(output) ? output.client : undefined,
  );

  if (isObject(output) && output.mock) {
    if (output.mock === 'msw') {
      data += defaultImports.implementation;
      data += defaultImports.implementationMSW;
    } else {
      data += defaultImports.implementationMock;
    }
  } else {
    data += defaultImports.implementation;
  }

  if (isObject(output) && output.schemas) {
    data += generateImports(imports, resolvePath(path, output.schemas), true);
  } else {
    data += generateModelsInline(schemas);
  }

  data += `\n${definition}`;
  data += `\n\n${implementation}`;

  if (isObject(output) && output.mock) {
    data += '\n\n';
    data += output.mock === 'msw' ? implementationMSW : implementationMocks;
  }

  writeFileSync(path, data);
};
