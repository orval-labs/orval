import { GlobalOptions, NormalizedConfig, NormalizedOptions } from '@orval/core';
export declare const generateSpec: (workspace: string, options: NormalizedOptions, projectName?: string) => Promise<void>;
export declare const generateSpecs: (config: NormalizedConfig, workspace: string, projectName?: string) => Promise<void[] | undefined>;
export declare const generateConfig: (configFile?: string, options?: GlobalOptions) => Promise<void>;
//# sourceMappingURL=generate.d.ts.map