import { GeneratorSchema } from '../../types/generator';

export const generateModelInline = (acc: string, model: string): string =>
  acc + `${model}\n`;

export const generateModelsInline = (
  obj: Record<string, GeneratorSchema[]>,
): string => {
  const schemas = Object.values(obj).reduce((acc, it) => [...acc, ...it], []);

  return schemas.reduce(
    (acc, { model }) => generateModelInline(acc, model),
    '',
  );
};
