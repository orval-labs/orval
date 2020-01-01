export const stringify = (data?: string | any[] | { [key: string]: any }): string | undefined => {
  if (typeof data === 'undefined' || data === null) {
    return;
  }

  if (typeof data === 'string') {
    return `'${data}'`;
  }

  if (typeof data === 'number' || typeof data === 'boolean' || typeof data === 'function') {
    return `${data}`;
  }

  if (Array.isArray(data)) {
    return `[${data.map(stringify).join(', ')}]`;
  }

  return Object.entries(data).reduce((acc, [key, value], index, arr) => {
    const strValue = stringify(value);
    if (arr.length === 1) {
      return `{ ${key}: ${strValue}, }`;
    }

    if (!index) {
      return `{ ${key}: ${strValue}, `;
    }

    if (arr.length - 1 === index) {
      return acc + `${key}: ${strValue}, }`;
    }

    return acc + `${key}: ${strValue}, `;
  }, '');
};
