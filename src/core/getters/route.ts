import { sanitize } from '../../utils/string';

const getRoutePath = (path: string) => {
  return path.split('').reduce((acc, letter) => {
    if (letter === '{') {
      return acc + '${';
    }

    if (letter === '}') {
      return acc + '}';
    }

    return acc + sanitize(letter, { dot: true });
  }, '');
};

export const getRoute = (route: string) => {
  const splittedRoute = route.split('/');

  return splittedRoute.reduce((acc, path, i) => {
    if (!path && !i) {
      return acc;
    }

    if (!path.includes('{')) {
      return `${acc}/${path}`;
    }

    return `${acc}/${getRoutePath(path)}`;
  }, '');
};
