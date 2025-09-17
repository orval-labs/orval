import { GlobalOptions, Options, OptionsExport } from '@orval/core';
import { defineConfig } from './utils/options';
declare const generate: (optionsExport?: string | OptionsExport, workspace?: string, options?: GlobalOptions) => Promise<void>;
export { defineConfig };
export { Options };
export { generate };
export * from '@orval/core';
export default generate;
//# sourceMappingURL=index.d.ts.map