import { camel, sanitize } from '@orval/core';

const hasParam = (path: string): boolean => /[^{]*{[\w*_-]*}.*/.test(path);

const getRoutePath = (path: string): string => {
  const matches = /([^{]*){?([\w*_-]*)}?(.*)/.exec(path);
  if (!matches?.length) return path; // impossible due to regexp grouping here, but for TS

  const prev = matches[1];
  const param = sanitize(camel(matches[2]), {
    es5keyword: true,
    underscore: true,
    dash: true,
    dot: true,
  });
  const next = hasParam(matches[3]) ? getRoutePath(matches[3]) : matches[3];

  return hasParam(path) ? `${prev}:${param}${next}` : `${prev}${param}${next}`;
};

export const getRouteMSW = (route: string, baseUrl = '*') => {
  route = route.replaceAll(':', String.raw`\:`);
  const splittedRoute = route.split('/');

  return splittedRoute.reduce((acc, path, i) => {
    if (!path && !i) {
      return acc;
    }

    if (!path.includes('{')) {
      return `${acc}/${path}`;
    }

    return `${acc}/${getRoutePath(path)}`;
  }, baseUrl);
};
