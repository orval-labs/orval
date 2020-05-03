import { GeneratorVerbOptions } from '../../types/generator';
import { dynamicImport } from '../../utils/imports';

type Transformer = (verbOption: GeneratorVerbOptions) => GeneratorVerbOptions;

export const getTransformer = (
  workspace: string,
  transformer?: string,
): Transformer =>
  transformer ? dynamicImport(transformer, workspace) : undefined;
