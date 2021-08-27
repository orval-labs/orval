import { generateConfig, generateSpec } from './generate';
import { Options, OptionsExport } from './types';
import { isString } from './utils/is';
import { defineConfig, normalizeOptions } from './utils/options';

const generate = async (
  optionsExport?: string | OptionsExport,
  workspace = process.cwd(),
  projectName?: string,
) => {
  if (!optionsExport || isString(optionsExport)) {
    return generateConfig(optionsExport, projectName);
  }

  const normalizedOptions = await normalizeOptions(optionsExport, workspace);
  return generateSpec(workspace, normalizedOptions, projectName);
};

export * from './types/generator';
export { defineConfig };
export { Options };
export { generate };

export default generate;
