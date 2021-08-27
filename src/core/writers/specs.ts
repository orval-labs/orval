import { join } from 'upath';
import { NormalizedOptions, OutputMode } from '../../types';
import { WriteSpecsProps } from '../../types/writers';
import { createSuccessMessage } from '../../utils/messages/logs';
import { getSpecName } from '../../utils/path';
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
        });
      }),
    );
  }

  if (!output.target) {
    createSuccessMessage(projectName || info.title);
    return;
  }

  if (output.mode === OutputMode.SINGLE) {
    await writeSingleMode({
      workspace,
      operations,
      output,
      info,
      schemas,
      specsName,
    });
  } else if (output.mode === OutputMode.SPLIT) {
    await writeSplitMode({
      workspace,
      operations,
      output,
      info,
      schemas,
      specsName,
    });
  } else if (output.mode === OutputMode.TAGS) {
    await writeTagsMode({
      workspace,
      operations,
      output,
      info,
      schemas,
      specsName,
    });
  } else if (output.mode === OutputMode.TAGS_SPLIT) {
    await writeSplitTagsMode({
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
