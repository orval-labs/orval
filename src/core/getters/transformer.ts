import { GeneratorVerbOptions } from '../../types/generator';
import { dynamicImport } from '../../utils/imports';

type Transformer = (verbOption: GeneratorVerbOptions) => GeneratorVerbOptions;

export const getTransformer = (transformer?: string): Transformer =>
  transformer ? dynamicImport(transformer) : undefined;
