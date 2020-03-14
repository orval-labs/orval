import {appendFileSync, existsSync, mkdirSync, writeFileSync} from 'fs';
import {join} from 'path';
import {getFilesHeader} from '../../messages/inline';
import {log} from '../../messages/logs';
import {Options} from '../../types';
import {WriteSpecsProps} from '../../types/writeSpecs';
import {createSuccessMessage} from '../createSuccessMessage';
import {generateImports} from '../generators/generateImports';
import {generateModels} from '../generators/generateModels';
import {generateModelsInline} from '../generators/generateModelsInline';
import {resolvePath} from '../resolvers/resolvePath';

export const writeSpecs = (options: Options, backend?: string) => ({
  api,
  models,
  mocks,
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

    generateModels(models, path, info);

    if (api.queryParamDefinitions) {
      generateModels(api.queryParamDefinitions, path, info);
    }
  }

  if (output) {
    const path = join(dir, output);
    let data = getFilesHeader(info);
    data +=
      "import { AxiosPromise, AxiosInstance, AxiosRequestConfig } from 'axios'\n";
    data += options.mock ? "import faker from 'faker'\n\n" : '\n';

    if (types) {
      data += generateImports(
        [...api.imports, ...mocks.imports],
        resolvePath(path, join(dir, types)),
        true
      );
    } else {
      data += generateModelsInline(models);

      if (api.queryParamDefinitions) {
        generateModelsInline(api.queryParamDefinitions);
      }
    }

    data += '\n';
    data += api.output;

    writeFileSync(path, data);

    if (options.mock) {
      appendFileSync(path, mocks.output);
    }

    log(createSuccessMessage(backend));
  }
};
