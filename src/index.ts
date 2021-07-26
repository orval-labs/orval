import { generateConfig, generateSpec } from './generate';
import { Options } from './types';
import { isString } from './utils/is';
import { normalizeOptions } from './utils/options';

const generate = (
  options?: string | Options,
  workspace = process.cwd(),
  projectName?: string,
) => {
  if (!options || isString(options)) {
    return generateConfig(options, projectName);
  }

  return generateSpec(workspace, normalizeOptions(options), projectName);
};

export * from './types/generator';
export { Options };
export { generate };
export default generate;
