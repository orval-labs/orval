import { sanitize } from '../../utils/string';

export const getRoute = (path: string) => {
  const splittedPath = path.split('/');

  return splittedPath.reduce((acc, it) => {
    if (!it) {
      return acc;
    }

    if (!it.includes('{')) {
      return `${acc}/${it}`;
    }

    const value = sanitize(it.slice(1, it.length - 1));

    return `${acc}/\$\{${value}\}`;
  }, '');
};
