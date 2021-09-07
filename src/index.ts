import { generateConfig, generateSpec } from './generate';
import { Options, OptionsExport } from './types';
import { isString } from './utils/is';
import { defineConfig, normalizeOptions } from './utils/options';
import { startWatcher } from './utils/watcher';

const generate = async (
  optionsExport?: string | OptionsExport,
  workspace = process.cwd(),
  projectName?: string,
  watch?: boolean | string | (string | boolean)[],
) => {
  if (!optionsExport || isString(optionsExport)) {
    return generateConfig(optionsExport, projectName, watch);
  }

  const normalizedOptions = await normalizeOptions(optionsExport, workspace);

  if (watch) {
    startWatcher(
      watch,
      () => generateSpec(process.cwd(), normalizedOptions),
      normalizedOptions.input.target as string,
    );
  } else {
    return generateSpec(workspace, normalizedOptions, projectName);
  }
};

export * from './types/generator';
export { defineConfig };
export { Options };
export { generate };

export default generate;
