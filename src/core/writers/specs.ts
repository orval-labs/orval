import { outputFile } from 'fs-extra';
import { join } from 'upath';
import { NormalizedOptions, OutputMode } from '../../types';
import { WriteSpecsProps } from '../../types/writers';
import { jsDoc } from '../../utils/doc';
import { getFileInfo } from '../../utils/file';
import { createSuccessMessage } from '../../utils/messages/logs';
import { getSpecName, relativeSafe } from '../../utils/path';
import { writeSchemas } from './schemas';
import { writeSingleMode } from './singleMode';
import { writeSplitMode } from './splitMode';
import { writeSplitTagsMode } from './splitTagsMode';
import { writeTagsMode } from './tagsMode';

export const writeSpecs = async (
  { operations, schemas, rootSpecKey, info }: WriteSpecsProps,
  workspace: string,
  options: NormalizedOptions,
  projectName?: string,
) => {
  const { output } = options;

  const specsName = Object.keys(schemas).reduce((acc, specKey) => {
    const basePath = getSpecName(specKey, rootSpecKey);

    const name = basePath.slice(1).split('/').join('-');

    return { ...acc, [specKey]: name };
  }, {} as Record<keyof typeof schemas, string>);

  const header = output.override.header
    ? jsDoc({
        description: output.override.header(info),
      })
    : '';

  if (output.schemas) {
    const rootSchemaPath = output.schemas;

    await Promise.all(
      Object.entries(schemas).map(([specKey, schemas]) => {
        const isRootKey = rootSpecKey === specKey;
        const schemaPath = !isRootKey
          ? join(rootSchemaPath, specsName[specKey])
          : rootSchemaPath;

        return writeSchemas({
          schemaPath,
          schemas,
          info,
          rootSpecKey,
          specsName,
          isRootKey,
          header,
        });
      }),
    );
  }

  if (!output.target) {
    createSuccessMessage(projectName || info.title);
    return;
  }

  let implementationPaths: string[] = [];

  if (output.mode === OutputMode.SINGLE) {
    implementationPaths = await writeSingleMode({
      workspace,
      operations,
      output,
      info,
      schemas,
      specsName,
      header,
    });
  } else if (output.mode === OutputMode.SPLIT) {
    implementationPaths = await writeSplitMode({
      workspace,
      operations,
      output,
      info,
      schemas,
      specsName,
      header,
    });
  } else if (output.mode === OutputMode.TAGS) {
    implementationPaths = await writeTagsMode({
      workspace,
      operations,
      output,
      info,
      schemas,
      specsName,
      header,
    });
  } else if (output.mode === OutputMode.TAGS_SPLIT) {
    implementationPaths = await writeSplitTagsMode({
      workspace,
      operations,
      output,
      info,
      schemas,
      specsName,
      header,
    });
  }

  if (output.workspace) {
    const workspacePath = output.workspace;
    let imports = implementationPaths
      .map(
        (path) =>
          `export * from '${relativeSafe(
            workspacePath,
            getFileInfo(path).pathWithoutExtension,
          )}';`,
      )
      .join('\n');

    if (output.schemas) {
      imports += `\nexport * from '${relativeSafe(
        workspacePath,
        getFileInfo(output.schemas).dirname,
      )}';`;
    }

    await outputFile(join(workspacePath, '/index.ts'), imports);
  }

  createSuccessMessage(projectName || info.title);
};
