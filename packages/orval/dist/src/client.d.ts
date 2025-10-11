import { ClientFileBuilder, ContextSpecs, GeneratorClientFooter, GeneratorClientHeader, GeneratorClientImports, GeneratorClientTitle, GeneratorOperations, GeneratorOptions, GeneratorVerbOptions, GeneratorVerbsOptions, NormalizedOutputOptions, OutputClient, OutputClientFunc } from '@orval/core';
export declare const generateClientImports: GeneratorClientImports;
export declare const generateClientHeader: GeneratorClientHeader;
export declare const generateClientFooter: GeneratorClientFooter;
export declare const generateClientTitle: GeneratorClientTitle;
export declare const generateOperations: (outputClient: (OutputClient | OutputClientFunc) | undefined, verbsOptions: GeneratorVerbsOptions, options: GeneratorOptions, output: NormalizedOutputOptions) => Promise<GeneratorOperations>;
export declare const generateExtraFiles: (outputClient: (OutputClient | OutputClientFunc) | undefined, verbsOptions: Record<string, GeneratorVerbOptions>, output: NormalizedOutputOptions, context: ContextSpecs) => Promise<ClientFileBuilder[]>;
//# sourceMappingURL=client.d.ts.map