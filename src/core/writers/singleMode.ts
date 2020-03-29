import {writeFileSync} from 'fs';
import {OutputOptions} from '../../types';
import {WriteSpecsProps} from '../../types/writers';
import {getFilesHeader} from '../../utils/messages/inline';
import {generateTarget} from '../generators/target';
import {generateImports} from '../generators/imports';
import {generateModelsInline} from '../generators/modelsInline';
import {resolvePath} from '../resolvers/path';

export const writeSingleMode = ({
  operations,
  schemas,
  info,
  output
}: WriteSpecsProps & {output: string | OutputOptions}) => {
  const path = (typeof output === 'string' ? output : output?.target) || '';
  const {
    definition,
    imports,
    implementation,
    implementationMocks
  } = generateTarget(operations, info);

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

  if (typeof output === 'object' && output.mock) {
    data += '\n\n';
    data += implementationMocks;
  }

  writeFileSync(path, data);
};
