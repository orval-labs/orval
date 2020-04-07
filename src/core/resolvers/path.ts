import { resolve } from 'path';
const segmentize = (uri: string) => uri.replace(/(^\/+|\/+$)/g, '').split('/');

export const resolvePath = (base: string, to: string) => {
  const toSegmentize = segmentize(resolve(to));
  const baseSegmentize = segmentize(resolve(base));

  return toSegmentize.reduce((acc: string, path: string, index: number) => {
    if (path === baseSegmentize[index]) {
      return acc;
    }

    if (!acc) {
      if (baseSegmentize.length - index > 1) {
        return `../${path}`;
      }
      return `./${path}`;
    }

    return `../${acc}/${path}`;
  }, '');
};
