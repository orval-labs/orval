import {
  createSuccessMessage,
  getFileInfo,
  isRootKey,
  jsDoc,
  log,
  NormalizedOptions,
  OutputMode,
  upath,
  writeSchemas,
  writeSingleMode,
  WriteSpecsBuilder,
  writeSplitMode,
  writeSplitTagsMode,
  writeTagsMode,
} from '@orval/core';
import chalk from 'chalk';
import execa from 'execa';
import fs from 'fs-extra';
import uniq from 'lodash.uniq';
import { InfoObject } from 'openapi3-ts';
import { executeHook } from './utils';

const getHeader = (
  option: false | ((info: InfoObject) => string | string[]),
  info: InfoObject,
): string => {
  if (!option) {
    return '';
  }

  const header = option(info);

  return Array.isArray(header) ? jsDoc({ description: header }) : header;
};

export const writeSpecs = async (
  builder: WriteSpecsBuilder,
  workspace: string,
  options: NormalizedOptions,
  projectName?: string,
) => {
  const { info, schemas, target } = builder;
  const { output } = options;
  const projectTitle = projectName || info.title;

  const specsName = Object.keys(schemas).reduce((acc, specKey) => {
    const basePath = upath.getSpecName(specKey, target);
    const name = basePath.slice(1).split('/').join('-');

    acc[specKey] = name;

    return acc;
  }, {} as Record<keyof typeof schemas, string>);

  const header = getHeader(output.override.header, info);

  if (output.schemas) {
    const rootSchemaPath = output.schemas;

    await Promise.all(
      Object.entries(schemas).map(([specKey, schemas]) => {
        const schemaPath = !isRootKey(specKey, target)
          ? upath.join(rootSchemaPath, specsName[specKey])
          : rootSchemaPath;

        return writeSchemas({
          schemaPath,
          schemas,
          target,
          specsName,
          specKey,
          isRootKey: isRootKey(specKey, target),
          header,
        });
      }),
    );
  }

  let implementationPaths: string[] = [];

  if (output.target) {
    const writeMode = getWriteMode(output.mode);
    implementationPaths = await writeMode({
      builder,
      workspace,
      output,
      specsName,
      header,
      needSchema: !output.schemas && output.client !== 'zod',
    });
  }

  if (output.workspace) {
    const workspacePath = output.workspace;
    let imports = implementationPaths
      .filter((path) => !path.endsWith('.msw.ts'))
      .map((path) =>
        upath.relativeSafe(
          workspacePath,
          getFileInfo(path).pathWithoutExtension,
        ),
      );

    if (output.schemas) {
      imports.push(
        upath.relativeSafe(workspacePath, getFileInfo(output.schemas).dirname),
      );
    }

    const indexFile = upath.join(workspacePath, '/index.ts');

    if (await fs.pathExists(indexFile)) {
      const data = await fs.readFile(indexFile, 'utf8');
      const importsNotDeclared = imports.filter((imp) => !data.includes(imp));
      await fs.appendFile(
        indexFile,
        uniq(importsNotDeclared)
          .map((imp) => `export * from '${imp}';`)
          .join('\n') + '\n',
      );
    } else {
      await fs.outputFile(
        indexFile,
        uniq(imports)
          .map((imp) => `export * from '${imp}';`)
          .join('\n') + '\n',
      );
    }

    implementationPaths = [indexFile, ...implementationPaths];
  }

  const paths = [
    ...(output.schemas ? [getFileInfo(output.schemas).dirname] : []),
    ...implementationPaths,
  ];

  if (options.hooks.afterAllFilesWrite) {
    await executeHook(
      'afterAllFilesWrite',
      options.hooks.afterAllFilesWrite,
      paths,
    );
  }

  if (output.prettier) {
    try {
      await execa('prettier', ['--write', ...paths]);
    } catch (e) {
      log(
        chalk.yellow(
          `⚠️  ${projectTitle ? `${projectTitle} - ` : ''}Prettier not found`,
        ),
      );
    }
  }

  createSuccessMessage(projectTitle);
};

const getWriteMode = (mode: OutputMode) => {
  switch (mode) {
    case OutputMode.SPLIT:
      return writeSplitMode;
    case OutputMode.TAGS:
      return writeTagsMode;
    case OutputMode.TAGS_SPLIT:
      return writeSplitTagsMode;
    case OutputMode.SINGLE:
    default:
      return writeSingleMode;
  }
};
