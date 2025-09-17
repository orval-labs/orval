import { ConfigExternal, GlobalOptions, NormalizedOptions, OptionsExport } from '@orval/core';
/**
 * Type helper to make it easier to use orval.config.ts
 * accepts a direct {@link ConfigExternal} object.
 */
export declare function defineConfig(options: ConfigExternal): ConfigExternal;
export declare const normalizeOptions: (optionsExport: OptionsExport, workspace?: string, globalOptions?: GlobalOptions) => Promise<NormalizedOptions>;
export declare const normalizePath: <T>(path: T, workspace: string) => string | T;
export declare const getDefaultFilesHeader: ({ title, description, version, }?: {
    title?: string;
    description?: string;
    version?: string;
}) => string[];
//# sourceMappingURL=options.d.ts.map