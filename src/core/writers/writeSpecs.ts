import {appendFileSync, existsSync, mkdirSync, writeFileSync} from 'fs';
import {join} from 'path';
import {Options} from '../../types';
import {WriteSpecsProps} from '../../types/writers';
import {getFilesHeader} from '../../utils/messages/inline';
import {createSuccessMessage} from '../../utils/messages/logs';
import {generateImports} from '../generators/generateImports';
import {generateModelsInline} from '../generators/generateModelsInline';
import {resolvePath} from '../resolvers/resolvePath';
import {writeModels} from './writeModels';

export const writeSpecs = (options: Options, backend?: string) => ({
  definition,
  implementation,
  implementationMocks,
  imports,
  schemas,
  info
}: WriteSpecsProps) => {
  const {output} = options;

  const path = (typeof output === 'string' ? output : output?.target) || '';

  if (!output || (typeof output === 'object' && !path && output?.schemas)) {
    throw new Error('You need to provide an output');
  }

  if (typeof output === 'object' && output.schemas) {
    if (!existsSync(output.schemas)) {
      mkdirSync(output.schemas);
    }

    writeFileSync(join(output.schemas, '/index.ts'), '');

    writeModels(schemas, output.schemas, info);
  }

  let data = getFilesHeader(info);
  data +=
    "import { AxiosPromise, AxiosInstance, AxiosRequestConfig } from 'axios'\n";
  data +=
    typeof output === 'object' && output.mock
      ? "import faker from 'faker'\n\n"
      : '\n';

  if (typeof output === 'object' && output.schemas) {
    data += generateImports(imports, resolvePath(path, output.schemas), true);
  } else {
    data += generateModelsInline(schemas);
  }

  data += '\n';
  data += definition;
  data += '\n\n';
  data += implementation;

  if (path) {
    writeFileSync(path, data);

    if (typeof output === 'object' && output.mock) {
      appendFileSync(path, implementationMocks);
    }
  }

  createSuccessMessage(backend);
};
