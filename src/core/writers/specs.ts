import { join } from 'path';
import { Options, OutputMode, OutputOptions } from '../../types';
import { WriteSpecsProps } from '../../types/writers';
import { useContext } from '../../utils/context';
import { isObject, isString } from '../../utils/is';
import { createSuccessMessage } from '../../utils/messages/logs';
import { writeSchemas } from './schemas';
import { writeSingleMode } from './singleMode';
import { writeSplitMode } from './splitMode';
import { writeSplitTagsMode } from './splitTagsMode';
import { writeTagsMode } from './tagsMode';

const isSingleMode = (output: string | OutputOptions): output is string =>
  isString(output) || !output.mode || output.mode === OutputMode.SINGLE;

export const writeSpecs = (
  workspace: string,
  options: Options,
  backend?: string,
) => ({ operations, schemas, info }: WriteSpecsProps) => {
  const { output } = options;

  if (!output || (isObject(output) && !output.target && !output.schemas)) {
    throw new Error('You need to provide an output');
  }

  if (isObject(output) && output.schemas) {
    const schemaPath = join(workspace, output.schemas);
    writeSchemas({ workspace, schemaPath, schemas, info });

    const [context] = useContext();

    Object.entries(context.specs).forEach(
      ([specKey, { basePath, schemas }]) => {
        const path = basePath.slice(1).split('/').join('-');
        writeSchemas({
          workspace,
          schemaPath: join(schemaPath, path),
          schemas,
          info,
          refSpec: !!specKey,
        });
      },
    );
  }

  if (isObject(output) && !output.target) {
    createSuccessMessage(backend);
    return;
  }

  if (isSingleMode(output)) {
    writeSingleMode({ workspace, operations, output, info, schemas });
  } else if (output.mode === OutputMode.SPLIT) {
    writeSplitMode({ workspace, operations, output, info, schemas });
  } else if (output.mode === OutputMode.TAGS) {
    writeTagsMode({ workspace, operations, output, info, schemas });
  } else if (output.mode === OutputMode.TAGS_SPLIT) {
    writeSplitTagsMode({ workspace, operations, output, info, schemas });
  }

  createSuccessMessage(backend);
};
