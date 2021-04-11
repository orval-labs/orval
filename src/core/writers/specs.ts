import { join } from 'upath';
import { Options, OutputMode, OutputOptions } from '../../types';
import { WriteSpecsProps } from '../../types/writers';
import { getExtension } from '../../utils/extension';
import { getFileInfo } from '../../utils/file';
import { isObject, isString } from '../../utils/is';
import { createSuccessMessage } from '../../utils/messages/logs';
import { isUrl } from '../../utils/url';
import { writeSchemas } from './schemas';
import { writeSingleMode } from './singleMode';
import { writeSplitMode } from './splitMode';
import { writeSplitTagsMode } from './splitTagsMode';
import { writeTagsMode } from './tagsMode';

const isSingleMode = (output: string | OutputOptions): output is string =>
  isString(output) || !output.mode || output.mode === OutputMode.SINGLE;

export const writeSpecs = async (
  { operations, schemas, rootSpecKey, info }: WriteSpecsProps,
  workspace: string,
  options: Options,
  projectName?: string,
) => {
  const { output } = options;

  if (!output || (isObject(output) && !output.target && !output.schemas)) {
    throw new Error('You need to provide an output');
  }

  const specsName = Object.keys(schemas).reduce((acc, specKey) => {
    const basePath = (isUrl(specKey)
      ? specKey.replace(rootSpecKey, '')
      : specKey.replace(getFileInfo(rootSpecKey).dirname, '')
    ).replace(`.${getExtension(specKey)}`, '');

    const name = basePath.slice(1).split('/').join('-');

    return { ...acc, [specKey]: name };
  }, {} as Record<keyof typeof schemas, string>);

  if (isObject(output) && output.schemas) {
    const rootSchemaPath = join(workspace, output.schemas);

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
        });
      }),
    );
  }

  if (isObject(output) && !output.target) {
    createSuccessMessage(projectName || info.title);
    return;
  }

  if (isSingleMode(output)) {
    writeSingleMode({
      workspace,
      operations,
      output: isString(output) ? { target: output } : output,
      info,
      schemas,
      specsName,
    });
  } else if (output.mode === OutputMode.SPLIT) {
    writeSplitMode({ workspace, operations, output, info, schemas, specsName });
  } else if (output.mode === OutputMode.TAGS) {
    writeTagsMode({ workspace, operations, output, info, schemas, specsName });
  } else if (output.mode === OutputMode.TAGS_SPLIT) {
    writeSplitTagsMode({
      workspace,
      operations,
      output,
      info,
      schemas,
      specsName,
    });
  }

  createSuccessMessage(projectName || info.title);
};
