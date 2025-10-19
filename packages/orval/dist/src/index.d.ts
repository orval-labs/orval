import { GlobalOptions, OptionsExport } from '@orval/core';
declare const generate: (optionsExport?: string | OptionsExport, workspace?: string, options?: GlobalOptions) => Promise<void>;
export { generate };
export * from '@orval/core';
export default generate;
export { defineConfig } from './utils/options';
export { Options } from '@orval/core';
//# sourceMappingURL=index.d.ts.map