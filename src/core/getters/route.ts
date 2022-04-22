import { camel } from '../../utils/case';
import { sanitize } from '../../utils/string';

const hasParam = (path: string) => /[^{]*{[\w_-]*}.*/.test(path)

const getRoutePath = (path: string) => {
  const matches = path.match(/([^{]*){?([\w_-]*)}?(.*)/)
  if (!matches?.length) return path // impossible due to regexp grouping here, but for TS
  const prev = matches[1]
  const param = sanitize(camel(matches[2]), { es5keyword: true, underscore: true, dash: true, dot: true })
  const next: string = hasParam(matches[3]) ? getRoutePath(matches[3]) : matches[3]
  if (hasParam(path)) {
    return `${prev}\${${param}}${next}`
  } else {
    return `${prev}${param}${next}`
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
