import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { OutputClient, OutputOptions } from '../../types';
import { WriteSpecsProps } from '../../types/writers';
import { camel, kebab, pascal } from '../../utils/case';
import { getFileInfo } from '../../utils/file';
import { getFilesHeader } from '../../utils/messages/inline';
import {
  generateClientImports,
  generateClientTitle,
} from '../generators/client';
import { generateImports } from '../generators/imports';
import { generateModelsInline } from '../generators/modelsInline';
import { resolvePath } from '../resolvers/path';
import { generateTargetForTags } from './targetTags';

export const writeSplitTagsMode = ({
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

  const target = generateTargetForTags(operations, info, output.client);

  Object.entries(target).forEach(([tag, target]) => {
    const {
      definition,
      imports,
      importsMocks,
      implementation,
      implementationMocks,
      implementationMSW,
    } = target;
    const header = getFilesHeader(info);

    let definitionData = header;
    let implementationData = header;
    let mockData = header;
    let mswData = header;

    const defaultImports = generateClientImports(output.client);
    const title = generateClientTitle(output.client, pascal(tag));

    definitionData += defaultImports.definition;

    const definitionPath = './' + kebab(tag) + '.definition';
    const definitionImport = generateImports(
      [title.definition],
      definitionPath,
      true,
    );

    implementationData += `${defaultImports.implementation}${definitionImport}`;
    mockData += `${defaultImports.implementationMock}${definitionImport}`;
    mswData += `${defaultImports.implementationMSW}`;

    if (output.schemas) {
      const schemasPath =
        '../' +
        resolvePath(path, getFileInfo(join(workspace, output.schemas)).dirname);

      const generatedImports = generateImports(imports, schemasPath, true);
      const generatedImportsMocks = generateImports(
        [...imports, ...importsMocks],
        schemasPath,
        true,
      );
      definitionData += generatedImports;
      implementationData += generatedImports;
      mockData += generatedImportsMocks;
      mswData += generatedImportsMocks;
    } else {
      const schemasPath = '../' + filename + '.schemas';
      const schemasData = header + generateModelsInline(schemas);

      writeFileSync(
        join(dirname, filename + '.schemas' + extension),
        schemasData,
      );

      const generatedImports = generateImports(imports, schemasPath, true);
      const generatedImportsMocks = generateImports(
        [...imports, ...importsMocks],
        schemasPath,
        true,
      );
      definitionData += generatedImports;
      implementationData += generatedImports;
      mockData += generatedImportsMocks;
      mswData += generatedImportsMocks;
    }

    definitionData += `\n${definition}`;
    implementationData += `\n${implementation}`;
    mockData += `\n${implementationMocks}`;
    mswData += `\n${implementationMSW}`;

    if (path) {
      if (!existsSync(join(dirname, kebab(tag)))) {
        mkdirSync(join(dirname, kebab(tag)));
      }

      writeFileSync(
        join(dirname, kebab(tag), definitionPath + extension),
        definitionData,
      );

      const implementationFilename =
        kebab(tag) +
        (OutputClient.ANGULAR === output.client ? '.service' : '') +
        extension;

      writeFileSync(
        join(dirname, kebab(tag), implementationFilename),
        implementationData,
      );

      if (output.mock) {
        if (output.mock === 'msw') {
          writeFileSync(
            join(dirname, kebab(tag), kebab(tag) + '.msw' + extension),
            mswData,
          );
        } else {
          writeFileSync(
            join(dirname, kebab(tag), kebab(tag) + '.mock' + extension),
            mockData,
          );
        }
      }
    }
  });
};
