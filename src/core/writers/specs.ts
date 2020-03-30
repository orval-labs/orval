import { Options, OutputMode, OutputOptions } from '../../types';
import { WriteSpecsProps } from '../../types/writers';
import { isObject, isString } from '../../utils/is';
import { createSuccessMessage } from '../../utils/messages/logs';
import { writeSchemas } from './schemas';
import { writeSingleMode } from './singleMode';
import { writeSplitMode } from './splitMode';
import { writeTagsMode } from './tagsMode';

const isSingleMode = (output: string | OutputOptions): output is string =>
  isString(output) || !output.mode || output.mode === OutputMode.SINGLE;

export const writeSpecs = (options: Options, backend?: string) => ({
  operations,
  schemas,
  info,
}: WriteSpecsProps) => {
  const { output } = options;

  if (!output || (isObject(output) && !output.target && !output.schemas)) {
    throw new Error('You need to provide an output');
  }

  if (isObject(output)) {
    writeSchemas({ output, schemas, info });
  }

  if (isObject(output) && !output.target) {
    createSuccessMessage(backend);
    return;
  }

  if (isSingleMode(output)) {
    writeSingleMode({ operations, output, info, schemas });
  } else if (output.mode === OutputMode.SPLIT) {
    writeSplitMode({ operations, output, info, schemas });
  } else if (output.mode === OutputMode.TAGS) {
    writeTagsMode({ operations, output, info, schemas });
  }

  createSuccessMessage(backend);
};
