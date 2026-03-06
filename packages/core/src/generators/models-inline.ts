import type { GeneratorSchema } from '../types';

export function generateModelInline(acc: string, model: string): string {
  return acc + `${model}\n`;
}

export function generateModelsInline(
  obj: Record<string, GeneratorSchema[]> | GeneratorSchema[],
): string {
  const schemas = Array.isArray(obj) ? obj : Object.values(obj).flat();

  let result = '';
  for (const { model } of schemas) {
    result = generateModelInline(result, model);
  }
  return result;
}
