import type { GeneratorSchema } from '../types.ts';

export function generateModelInline(acc: string, model: string): string {
  return acc + `${model}\n`;
}

export function generateModelsInline(
  obj: Record<string, GeneratorSchema[]>,
): string {
  const schemas = Object.values(obj).flat();

  let result = '';
  for (const { model } of schemas) {
    result = generateModelInline(result, model);
  }
  return result;
}
