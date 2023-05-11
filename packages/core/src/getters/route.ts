import { camel, sanitize } from '../utils';

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

// transform "blabla{param}" string into ["blabla", "${param}"] array
export function getRouteArray(input: string): string[] {
  const output = [];
  let current = '';

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (char === '{') {
      output.push(current);
      current = '';
    }

    current += char;

    if (char === '}') {
      output.push(getRoutePath(current));
      current = '';
    }
  }

  if (current) {
    output.push(current);
  }

  console.log({ input, output });

  return output;
}
