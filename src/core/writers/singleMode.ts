import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { OutputOptions } from '../../types';
import { WriteSpecsProps } from '../../types/writers';
import { camel } from '../../utils/case';
import { getFileInfo } from '../../utils/file';
import { isObject, isString } from '../../utils/is';
import { getFilesHeader } from '../../utils/messages/inline';
import { generateClientImports } from '../generators/client';
import { generateMutatorImports } from '../generators/imports';
import { generateModelsInline } from '../generators/modelsInline';
import { generateMSWImports } from '../generators/msw';
import { resolvePath } from '../resolvers/path';
import { generateTarget } from './target';

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
    mkdirSync(dirname, { recursive: true });
  }

  const {
    imports,
    implementation,
    implementationMSW,
    importsMSW,
    mutators,
  } = generateTarget(operations, info, isObject(output) ? output : undefined);

  let data = getFilesHeader(info);

  if (isObject(output) && output.schemas) {
    const schemasPath = resolvePath(output.target || '', output.schemas);

    data += generateClientImports(output.client, implementation, [
      { exports: imports, dependency: schemasPath },
    ]);
    if (output.mock) {
      data += generateMSWImports(implementationMSW, [
        { exports: importsMSW, dependency: schemasPath },
      ]);
    }
  } else {
    data += generateClientImports(
      isObject(output) ? output.client : undefined,
      implementation,
      [],
    );

    if (isObject(output) && output.mock) {
      data += generateMSWImports(implementationMSW, []);
    }

    data += generateModelsInline(schemas);
  }

  if (mutators) {
    data += generateMutatorImports(mutators);
  }

  data += `\n\n${implementation}`;

  if (isObject(output) && output.mock) {
    data += '\n\n';
    data += implementationMSW;
  }

  writeFileSync(path, data);
};
