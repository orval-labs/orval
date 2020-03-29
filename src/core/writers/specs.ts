import {Options, OutputMode} from '../../types';
import {WriteSpecsProps} from '../../types/writers';
import {createSuccessMessage} from '../../utils/messages/logs';
import {writeSchemas} from './schemas';
import {writeSingleMode} from './singleMode';
import {writeSplitMode} from './splitMode';

export const writeSpecs = (options: Options, backend?: string) => ({
  operations,
  schemas,
  info
}: WriteSpecsProps) => {
  const {output} = options;

  if (
    !output ||
    (typeof output === 'object' && !output.target && output?.schemas)
  ) {
    throw new Error('You need to provide an output');
  }

  if (typeof output === 'object') {
    writeSchemas({output, schemas, info});
  }

  if (typeof output === 'object' && !output.target) {
    createSuccessMessage(backend);
    return;
  }

  if (
    typeof output === 'string' ||
    !output.mode ||
    output.mode === OutputMode.SINGLE
  ) {
    writeSingleMode({operations, output, info, schemas});
  } else {
    writeSplitMode({operations, output, info, schemas});
  }

  createSuccessMessage(backend);
};
