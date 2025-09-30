import type { GeneratorSchema } from '../types';

export const generateModelInline = (acc: string, model: string): string =>
  acc + `${model}\n`;

export const generateModelsInline = (
  obj: Record<string, GeneratorSchema[]>,
): string => {
  const schemas = Object.values(obj).flat();

  return schemas.reduce<string>(
    (acc, { model }) => generateModelInline(acc, model),
    '',
  );
};
