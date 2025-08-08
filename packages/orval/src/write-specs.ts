import {
  createSuccessMessage,
  getFileInfo,
  getMockFileExtensionByTypeName,
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
import { InfoObject } from 'openapi3-ts/oas30';
import { TypeDocOptions } from 'typedoc';
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
  const { info = { title: '', version: 0 }, schemas, target } = builder;
  const { output } = options;
  const projectTitle = projectName || info.title;

  const specsName = Object.keys(schemas).reduce(
    (acc, specKey) => {
      const basePath = upath.getSpecName(specKey, target);
      const name = basePath.slice(1).split('/').join('-');

      acc[specKey] = name;

      return acc;
    },
    {} as Record<keyof typeof schemas, string>,
  );

  const header = getHeader(output.override.header, info as InfoObject);

  if (output.schemas) {
    const rootSchemaPath = output.schemas;

    const fileExtension = ['tags', 'tags-split', 'split'].includes(output.mode)
      ? '.ts'
      : (output.fileExtension ?? '.ts');

    await Promise.all(
      Object.entries(schemas).map(([specKey, schemas]) => {
        const schemaPath = !isRootKey(specKey, target)
          ? upath.join(rootSchemaPath, specsName[specKey])
          : rootSchemaPath;

        return writeSchemas({
          schemaPath,
          schemas,
          target,
          namingConvention: output.namingConvention,
          fileExtension,
          specsName,
          specKey,
          isRootKey: isRootKey(specKey, target),
          header,
          indexFiles: output.indexFiles,
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
          uniq(importsNotDeclared)
            .map((imp) => `export * from '${imp}';\n`)
            .join(''),
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
  }

  if (builder.extraFiles.length) {
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
    } catch (e: any) {
      const message =
        e.exitCode === 1
          ? e.stdout + e.stderr
          : `⚠️  ${projectTitle ? `${projectTitle} - ` : ''}biome not found`;

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
        throw new Error('TypeDoc not initialised');
      }
    } catch (e: any) {
      const message =
        e.exitCode === 1
          ? e.stdout + e.stderr
          : `⚠️  ${projectTitle ? `${projectTitle} - ` : ''}Unable to generate docs`;

      log(chalk.yellow(message));
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
