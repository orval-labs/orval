import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { OutputOptions } from '../../types';
import { WriteSpecsProps } from '../../types/writers';
import { camel } from '../../utils/case';
import { getFileInfo } from '../../utils/file';
import { getFilesHeader } from '../../utils/messages/inline';
import {
  generateClientImports,
  generateClientTitle,
} from '../generators/client';
import { generateImports } from '../generators/imports';
import { generateModelsInline } from '../generators/modelsInline';
import { generateTarget } from '../generators/target';
import { resolvePath } from '../resolvers/path';

export const writeSplitMode = ({
  operations,
  schemas,
  info,
  output,
  workspace,
}: WriteSpecsProps & { workspace: string; output: OutputOptions }) => {
  const { path, filename, dirname, extension } = getFileInfo(
    join(workspace, output.target || ''),
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
  } = generateTarget(operations, info, output.client);

  const header = getFilesHeader(info);

  let definitionData = header;
  let implementationData = header;
  let mockData = header;

  const defaultImports = generateClientImports(output.client);
  const title = generateClientTitle(output.client, info.title);

  console.log(title);

  definitionData += defaultImports.definition;

  const definitionPath = './' + filename + '.definition';
  const definitionImport = generateImports(
    [title.definition],
    definitionPath,
    true,
  );

  implementationData += `${defaultImports.implementation}${definitionImport}`;
  mockData += `${defaultImports.implementationMock}${definitionImport}`;

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

  definitionData += `\n${definition}`;
  implementationData += `\n${implementation}`;
  mockData += `\n${implementationMocks}`;

  if (path) {
    writeFileSync(join(dirname, definitionPath + extension), definitionData);
    writeFileSync(join(dirname, filename + extension), implementationData);

    if (output.mock) {
      writeFileSync(join(dirname, filename + '.mock' + extension), mockData);
    }
  }
};
