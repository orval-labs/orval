import {pascal} from 'case';
import {appendFileSync, existsSync, mkdirSync, writeFileSync} from 'fs';
import {basename, dirname, join} from 'path';
import {Options, OutputMode} from '../../types';
import {WriteSpecsProps} from '../../types/writers';
import {getFilesHeader} from '../../utils/messages/inline';
import {createSuccessMessage} from '../../utils/messages/logs';
import {generateImports} from '../generators/imports';
import {generateModelsInline} from '../generators/modelsInline';
import {resolvePath} from '../resolvers/path';
import {writeModels} from './models';

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

  if (!path) {
    createSuccessMessage(backend);
    return;
  }

  const header = getFilesHeader(info);

  if (
    typeof output === 'string' ||
    !output.mode ||
    output.mode === OutputMode.SINGLE
  ) {
    let data = header;
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

    writeFileSync(path, data);

    if (typeof output === 'object' && output.mock) {
      appendFileSync(path, implementationMocks);
    }
  } else {
    let definitionData = header;
    let implementationData = header;
    let mockData = header;

    const filename = basename(path, '.ts');
    const dir = dirname(path);

    definitionData += "import { AxiosPromise } from 'axios'\n";

    const definitionPath = './' + filename + '.definition';
    const definitionImport = generateImports(
      [pascal(info.title)],
      definitionPath,
      true
    );

    implementationData += `import { AxiosPromise, AxiosInstance, AxiosRequestConfig } from 'axios'\n${definitionImport}`;
    mockData += `import { AxiosPromise } from 'axios'\nimport faker from 'faker'\n${definitionImport}`;

    if (output.schemas) {
      const schemasPath = resolvePath(path, output.schemas);

      definitionData += generateImports(imports, schemasPath, true);
      implementationData += generateImports(imports, schemasPath, true);
      mockData += generateImports(imports, schemasPath, true);
    } else {
      const schemasPath = './' + filename + '.schemas';
      const schemasData = header + generateModelsInline(schemas);

      writeFileSync(join(dir, schemasPath + '.ts'), schemasData);

      definitionData += generateImports(imports, schemasPath, true);
      implementationData += generateImports(imports, schemasPath, true);
      mockData += generateImports(imports, schemasPath, true);
    }

    definitionData += definition;
    implementationData += implementation;
    mockData += implementationMocks;

    if (path) {
      writeFileSync(join(dir, definitionPath + '.ts'), definitionData);
      writeFileSync(join(dir, filename + '.ts'), implementationData);

      if (output.mock) {
        writeFileSync(join(dir, filename + '.mock.ts'), mockData);
      }
    }
  }

  createSuccessMessage(backend);
};
