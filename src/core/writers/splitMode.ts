import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { OutputClient, OutputOptions } from '../../types';
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
import { resolvePath } from '../resolvers/path';
import { generateTarget } from './target';

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
    implementationMSW,
  } = generateTarget(operations, info, output.client);

  const header = getFilesHeader(info);

  let definitionData = header;
  let implementationData = header;
  let mockData = header;
  let mswData = header;

  const defaultImports = generateClientImports(output.client);
  const title = generateClientTitle(output.client, info.title);

  definitionData += defaultImports.definition;

  const definitionPath = './' + filename + '.definition';
  const definitionImport = generateImports(
    [title.definition],
    definitionPath,
    true,
  );

  implementationData += `${defaultImports.implementation}${definitionImport}`;
  mockData += `${defaultImports.implementationMock}${definitionImport}`;
  mswData += `${defaultImports.implementationMSW}`;

  if (output.schemas) {
    const schemasPath = resolvePath(
      path,
      getFileInfo(join(workspace, output.schemas)).dirname,
    );

    const generatedImports = generateImports(imports, schemasPath, true);
    definitionData += generatedImports;
    implementationData += generatedImports;
    mockData += generatedImports;
    mswData += generatedImports;
  } else {
    const schemasPath = './' + filename + '.schemas';
    const schemasData = header + generateModelsInline(schemas);

    writeFileSync(
      join(dirname, filename + '.schemas' + extension),
      schemasData,
    );

    const generatedImports = generateImports(imports, schemasPath, true);
    definitionData += generatedImports;
    implementationData += generatedImports;
    mockData += generatedImports;
    mswData += generatedImports;
  }

  definitionData += `\n${definition}`;
  implementationData += `\n${implementation}`;
  mockData += `\n${implementationMocks}`;
  mswData += `\n${implementationMSW}`;

  if (path) {
    writeFileSync(join(dirname, definitionPath + extension), definitionData);

    const implementationFilename =
      filename +
      (OutputClient.ANGULAR === output.client ? '.service' : '') +
      extension;

    writeFileSync(join(dirname, implementationFilename), implementationData);

    if (output.mock) {
      if (output.mock === 'msw') {
        writeFileSync(join(dirname, filename + '.msw' + extension), mswData);
      } else {
        writeFileSync(join(dirname, filename + '.mock' + extension), mockData);
      }
    }
  }
};
