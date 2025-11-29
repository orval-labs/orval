import {
  createSuccessMessage,
  getFileInfo,
  getMockFileExtensionByTypeName,
  isRootKey,
  jsDoc,
  log,
  type NormalizedOptions,
  OutputMode,
  upath,
  writeSchemas,
  writeSingleMode,
  type WriteSpecBuilder,
  writeSplitMode,
  writeSplitTagsMode,
  writeTagsMode,
} from '@orval/core';
import chalk from 'chalk';
import { execa, ExecaError } from 'execa';
import fs from 'fs-extra';
import type { InfoObject } from 'openapi3-ts/oas30';
import { unique } from 'remeda';
import type { TypeDocOptions } from 'typedoc';

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

export async function writeSpecs(
  builder: WriteSpecBuilder,
  workspace: string,
  options: NormalizedOptions,
  projectName?: string,
) {
  const { info = { title: '', version: 0 }, schemas, target } = builder;
  const { output } = options;
  const projectTitle = projectName ?? info.title;
  const basePath = upath.getSpecName(target, target);
  const specName = basePath.slice(1).split('/').join('-');

  const header = getHeader(output.override.header, info as InfoObject);

  if (output.schemas) {
    const rootSchemaPath = output.schemas;

    const fileExtension = ['tags', 'tags-split', 'split'].includes(output.mode)
      ? '.ts'
      : output.fileExtension;

    const schemaPath = isRootKey(target, target)
      ? rootSchemaPath
      : upath.join(rootSchemaPath, specName);

    await writeSchemas({
      schemaPath,
      schemas,
      target,
      namingConvention: output.namingConvention,
      fileExtension,
      specName,
      specKey: target,
      isRootKey: isRootKey(target, target),
      header,
      indexFiles: output.indexFiles,
    });
  }

  let implementationPaths: string[] = [];

  if (output.target) {
    const writeMode = getWriteMode(output.mode);
    implementationPaths = await writeMode({
      builder,
      workspace,
      output,
      projectName,
      header,
      needSchema: !output.schemas && output.client !== 'zod',
    });
  }

  if (output.workspace) {
    const workspacePath = output.workspace;
    const imports = implementationPaths
      .filter(
        (path) =>
          !output.mock ||
          !path.endsWith(`.${getMockFileExtensionByTypeName(output.mock)}.ts`),
      )
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

    if (output.indexFiles) {
      const indexFile = upath.join(workspacePath, '/index.ts');

      if (await fs.pathExists(indexFile)) {
        const data = await fs.readFile(indexFile, 'utf8');
        const importsNotDeclared = imports.filter((imp) => !data.includes(imp));
        await fs.appendFile(
          indexFile,
          unique(importsNotDeclared)
            .map((imp) => `export * from '${imp}';\n`)
            .join(''),
        );
      } else {
        await fs.outputFile(
          indexFile,
          unique(imports)
            .map((imp) => `export * from '${imp}';`)
            .join('\n') + '\n',
        );
      }

      implementationPaths = [indexFile, ...implementationPaths];
    }
  }

  if (builder.extraFiles.length > 0) {
    await Promise.all(
      builder.extraFiles.map(async (file) =>
        fs.outputFile(file.path, file.content),
      ),
    );

    implementationPaths = [
      ...implementationPaths,
      ...builder.extraFiles.map((file) => file.path),
    ];
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
    } catch {
      log(
        chalk.yellow(
          `⚠️  ${projectTitle ? `${projectTitle} - ` : ''}Globally installed prettier not found`,
        ),
      );
    }
  }

  if (output.biome) {
    try {
      await execa('biome', ['check', '--write', ...paths]);
    } catch (error) {
      let message = `⚠️  ${projectTitle ? `${projectTitle} - ` : ''}biome not found`;
      if (error instanceof ExecaError && error.exitCode === 1)
        message = error.message;

      log(chalk.yellow(message));
    }
  }

  if (output.docs) {
    try {
      let config: Partial<TypeDocOptions> = {};
      let configPath: string | null = null;
      if (typeof output.docs === 'object') {
        ({ configPath = null, ...config } = output.docs);
        if (configPath) {
          config.options = configPath;
        }
      }

      const getTypedocApplication = async () => {
        const { Application } = await import('typedoc');
        return Application;
      };

      const Application = await getTypedocApplication();
      const app = await Application.bootstrapWithPlugins({
        entryPoints: paths,
        theme: 'markdown',
        // Set the custom config location if it has been provided.
        ...config,
        plugin: ['typedoc-plugin-markdown', ...(config.plugin ?? [])],
      });
      // Set defaults if the have not been provided by the external config.
      if (!app.options.isSet('readme')) {
        app.options.setValue('readme', 'none');
      }
      if (!app.options.isSet('logLevel')) {
        app.options.setValue('logLevel', 'None');
      }
      const project = await app.convert();
      if (project) {
        await app.generateDocs(project, app.options.getValue('out') as string);
      } else {
        throw new Error('TypeDoc not initialized');
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `⚠️  ${projectTitle ? `${projectTitle} - ` : ''}Unable to generate docs`;

      log(chalk.yellow(message));
    }
  }

  createSuccessMessage(projectTitle);
}

const getWriteMode = (mode: OutputMode) => {
  switch (mode) {
    case OutputMode.SPLIT: {
      return writeSplitMode;
    }
    case OutputMode.TAGS: {
      return writeTagsMode;
    }
    case OutputMode.TAGS_SPLIT: {
      return writeSplitTagsMode;
    }
    case OutputMode.SINGLE:
    default: {
      return writeSingleMode;
    }
  }
};
