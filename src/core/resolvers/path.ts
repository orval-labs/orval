import { resolve, sep } from 'path';
import { getFileInfo } from '../../utils/file';
const segmentize = (uri: string) => uri.split(sep);

export const resolvePath = (base: string, to: string) => {
  const baseInfo = getFileInfo(resolve(base));
  const toSegmentize = segmentize(resolve(to));
  const baseSegmentize = segmentize(baseInfo.path);

  return toSegmentize.reduce((acc: string, path: string, index: number) => {
    if (path === baseSegmentize[index]) {
      return acc;
    }

    if (!acc) {
      if (
        toSegmentize.length - index > 1 ||
        baseSegmentize.length - index > 1
      ) {
        return `../${path}`;
      }
      return `./${path}`;
    }

    if (toSegmentize.length - index === 1) {
      return `${acc}/${path}`;
    }

    return `../${acc}/${path}`;
  }, '');
};
