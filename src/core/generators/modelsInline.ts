import { GeneratorSchema } from '../../types/generator';

export const generateModelInline = (acc: string, model: string): string =>
  acc + `${model}\n`;

export const generateModelsInline = (array: GeneratorSchema[]): string =>
  array.reduce((acc, { model }) => generateModelInline(acc, model), '');
