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
    prettier?: boolean;
  },
) => {
  if (!optionsExport || isString(optionsExport)) {
    return generateConfig(optionsExport, options);
  }

  const normalizedOptions = await normalizeOptions(
    optionsExport,
    workspace,
    options?.clean,
    options?.prettier,
  );

  if (options?.watch) {
    startWatcher(
      options?.watch,
      () => generateSpec(workspace, normalizedOptions),
      normalizedOptions.input.target as string,
    );
  } else {
    return generateSpec(workspace, normalizedOptions);
  }
};

export * from './types/generator';
export { defineConfig };
export { Options };
export { generate };

export default generate;
