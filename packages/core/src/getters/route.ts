import { camel, sanitize } from '../utils';
import { TEMPLATE_TAG_REGEX } from '../constants';

const TEMPLATE_TAG_IN_PATH_REGEX = /\/([\w]+)(?:\$\{)/g; // all dynamic parts of path

const hasParam = (path: string): boolean => /[^{]*{[\w*_-]*}.*/.test(path);

const getRoutePath = (path: string): string => {
  const matches = path.match(/([^{]*){?([\w*_-]*)}?(.*)/);
  if (!matches?.length) return path; // impossible due to regexp grouping here, but for TS

  const prev = matches[1];
  const param = sanitize(camel(matches[2]), {
    es5keyword: true,
    underscore: true,
    dash: true,
    dot: true,
  });
  const next = hasParam(matches[3]) ? getRoutePath(matches[3]) : matches[3];

  if (hasParam(path)) {
    return `${prev}\${${param}}${next}`;
  } else {
    return `${prev}${param}${next}`;
  }
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

// Creates a mixed use array with path variables and string from template string route
export const getRouteAsArray = (route: string): string =>
  route
    .replace(TEMPLATE_TAG_IN_PATH_REGEX, '/$1/${')
    .split('/')
    .filter((i) => i !== '')
    .map((i) =>
      // @note - array is mixed with string and var
      i.includes('${') ? i.replace(TEMPLATE_TAG_REGEX, '$1') : `'${i}'`,
    )
    .join(',')
    .replace(',,', '');
