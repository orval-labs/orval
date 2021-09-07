import { generateConfig, generateSpec } from './generate';
import { Options, OptionsExport } from './types';
import { isString } from './utils/is';
import { defineConfig, normalizeOptions } from './utils/options';
import { startWatcher } from './utils/watcher';

const generate = async (
  optionsExport?: string | OptionsExport,
  workspace = process.cwd(),
  options?: {
    projectName?: string;
    watch?: boolean | string | (string | boolean)[];
    clean?: boolean | string[];
  },
) => {
  if (!optionsExport || isString(optionsExport)) {
    return generateConfig(optionsExport, options);
  }

  const normalizedOptions = await normalizeOptions(
    optionsExport,
    workspace,
    options?.clean,
  );

  if (options?.watch) {
    startWatcher(
      options?.watch,
      () => generateSpec(process.cwd(), normalizedOptions),
      normalizedOptions.input.target as string,
    );
  } else {
    return generateSpec(workspace, normalizedOptions, options?.projectName);
  }
};

export * from './types/generator';
export { defineConfig };
export { Options };
export { generate };

export default generate;
