export interface Options {
  output?: string;
  outputFile?: string;
  types?: string;
  workDir?: string;
  file?: string;
  github?: string;
  transformer?: string;
  validation?: boolean;
  mock?: boolean;
}

export type AdvancedOptions = Options;

export interface ExternalConfigFile {
  [backend: string]: AdvancedOptions;
}
