import {camel, pascal} from 'case';
import {existsSync, mkdirSync, writeFileSync} from 'fs';
import {join} from 'path';
import {OutputOptions} from '../../types';
import {WriteSpecsProps} from '../../types/writers';
import {getFileInfo} from '../../utils/file';
import {getFilesHeader} from '../../utils/messages/inline';
import {generateImports} from '../generators/imports';
import {generateModelsInline} from '../generators/modelsInline';
import {generateTarget} from '../generators/target';
import {resolvePath} from '../resolvers/path';

export const writeSplitMode = ({
  operations,
  schemas,
  info,
  output
}: WriteSpecsProps & {output: OutputOptions}) => {
  const {path, filename, dirname, extension} = getFileInfo(
    output.target,
    camel(info.title)
  );

  if (!existsSync(dirname)) {
    mkdirSync(dirname);
  }

  const {
    definition,
    imports,
    implementation,
    implementationMocks
  } = generateTarget(operations, info);

  const header = getFilesHeader(info);

  let definitionData = header;
  let implementationData = header;
  let mockData = header;

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

    writeFileSync(join(dirname, schemasPath + extension), schemasData);

    definitionData += generateImports(imports, schemasPath, true);
    implementationData += generateImports(imports, schemasPath, true);
    mockData += generateImports(imports, schemasPath, true);
  }

  definitionData += definition;
  implementationData += implementation;
  mockData += implementationMocks;

  if (path) {
    writeFileSync(join(dirname, definitionPath + extension), definitionData);
    writeFileSync(join(dirname, filename + extension), implementationData);

    if (output.mock) {
      writeFileSync(join(dirname, filename + '.mock' + extension), mockData);
    }
  }
};
