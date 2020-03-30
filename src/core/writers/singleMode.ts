import { camel } from 'case';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { OutputOptions } from '../../types';
import { WriteSpecsProps } from '../../types/writers';
import { getFileInfo } from '../../utils/file';
import { isObject, isString } from '../../utils/is';
import { getFilesHeader } from '../../utils/messages/inline';
import { generateImports } from '../generators/imports';
import { generateModelsInline } from '../generators/modelsInline';
import { generateTarget } from '../generators/target';
import { resolvePath } from '../resolvers/path';

export const writeSingleMode = ({
  operations,
  schemas,
  info,
  output,
}: WriteSpecsProps & { output: string | OutputOptions }) => {
  const { path, dirname } = getFileInfo(
    isString(output) ? output : output.target,
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
  } = generateTarget(operations, info);

  let data = getFilesHeader(info);
  data +=
    "import { AxiosPromise, AxiosInstance, AxiosRequestConfig } from 'axios'\n";
  data +=
    isObject(output) && output.mock ? "import faker from 'faker'\n\n" : '\n';

  if (isObject(output) && output.schemas) {
    data += generateImports(imports, resolvePath(path, output.schemas), true);
  } else {
    data += generateModelsInline(schemas);
  }

  data += '\n';
  data += definition;
  data += '\n\n';
  data += implementation;

  if (isObject(output) && output.mock) {
    data += '\n\n';
    data += implementationMocks;
  }

  writeFileSync(path, data);
};
