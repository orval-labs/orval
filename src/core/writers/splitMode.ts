import {pascal} from 'case';
import {writeFileSync} from 'fs';
import {basename, dirname, join} from 'path';
import {OutputOptions} from '../../types';
import {WriteSpecsProps} from '../../types/writers';
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
  const path = output.target!;
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
};
