import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { OutputClient, OutputOptions } from '../../types';
import { WriteSpecsProps } from '../../types/writers';
import { camel } from '../../utils/case';
import { getFileInfo } from '../../utils/file';
import { getFilesHeader } from '../../utils/messages/inline';
import { generateClientImports } from '../generators/client';
import { generateMutatorImports } from '../generators/imports';
import { generateModelsInline } from '../generators/modelsInline';
import { generateMSWImports } from '../generators/msw';
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
    { backupFilename: camel(info.title) },
  );

  if (!existsSync(dirname)) {
    mkdirSync(dirname);
  }

  const {
    imports,
    implementation,
    implementationMSW,
    importsMSW,
    mutators,
  } = generateTarget(operations, info, output);

  const header = getFilesHeader(info);

  let implementationData = header;
  let mswData = header;

  if (output.schemas) {
    const schemasPath = resolvePath(
      path,
      getFileInfo(join(workspace, output.schemas)).dirname,
    );

    implementationData += generateClientImports(output.client, implementation, [
      { exports: imports, dependency: schemasPath },
    ]);
    mswData += generateMSWImports(implementationMSW, [
      { exports: [...imports, ...importsMSW], dependency: schemasPath },
    ]);
  } else {
    const schemasPath = './' + filename + '.schemas';
    const schemasData = header + generateModelsInline(schemas);

    writeFileSync(
      join(dirname, filename + '.schemas' + extension),
      schemasData,
    );

    implementationData += generateClientImports(output.client, implementation, [
      { exports: imports, dependency: schemasPath },
    ]);
    mswData += generateMSWImports(implementationMSW, [
      { exports: [...imports, ...importsMSW], dependency: schemasPath },
    ]);
  }

  if (mutators) {
    implementationData += generateMutatorImports(mutators);
  }

  implementationData += `\n${implementation}`;
  mswData += `\n${implementationMSW}`;

  if (path) {
    const implementationFilename =
      filename +
      (OutputClient.ANGULAR === output.client ? '.service' : '') +
      extension;

    writeFileSync(join(dirname, implementationFilename), implementationData);

    if (output.mock) {
      writeFileSync(join(dirname, filename + '.msw' + extension), mswData);
    }
  }
};
