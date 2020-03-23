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
  const {types, output, workDir = ''} = options;
  const dir = join(process.cwd(), workDir);

  if (types) {
    const path = join(dir, types);

    if (!existsSync(path)) {
      mkdirSync(path);
    }

    writeFileSync(join(path, '/index.ts'), '');

    writeModels(schemas, path, info);
  }

  if (output) {
    const path = join(dir, output);
    let data = getFilesHeader(info);
    data +=
      "import { AxiosPromise, AxiosInstance, AxiosRequestConfig } from 'axios'\n";
    data += options.mock ? "import faker from 'faker'\n\n" : '\n';

    if (types) {
      data += generateImports(
        imports,
        resolvePath(path, join(dir, types)),
        true
      );
    } else {
      data += generateModelsInline(schemas);
    }

    data += '\n';
    data += definition;
    data += '\n\n';
    data += implementation;

    writeFileSync(path, data);

    if (options.mock) {
      appendFileSync(path, implementationMocks);
    }

    createSuccessMessage(backend);
  }
};
