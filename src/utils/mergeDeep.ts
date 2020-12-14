const isObject = (obj: unknown) => obj && typeof obj === 'object';

export function mergeDeep(target: any, source: any): any {
  if (!isObject(target) || !isObject(source)) {
    return source;
  }

  return Object.entries(source).reduce((acc, [key, value]) => {
    const targetValue = acc[key];

    if (Array.isArray(targetValue) && Array.isArray(value)) {
      return { ...acc, [key]: [...targetValue, ...value] };
    }
    if (isObject(targetValue) && isObject(value)) {
      return { ...acc, [key]: mergeDeep(targetValue, value) };
    }
    return { ...acc, [key]: value };
  }, target);
}
