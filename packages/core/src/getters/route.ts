import { TEMPLATE_TAG_REGEX } from '../constants.ts';
import type {
  BaseUrlFromConstant,
  BaseUrlFromSpec,
  OpenApiServerObject,
} from '../types.ts';
import { camel, isString, sanitize } from '../utils/index.ts';

const TEMPLATE_TAG_IN_PATH_REGEX = /\/([\w]+)(?:\$\{)/g; // all dynamic parts of path

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

  return hasParam(path)
    ? `${prev}\${${param}}${next}`
    : `${prev}${param}${next}`;
};

export function getRoute(route: string) {
  const splittedRoute = route.split('/');

  let result = '';
  for (const [i, path] of splittedRoute.entries()) {
    if (!path && !i) {
      continue;
    }

    result += path.includes('{') ? `/${getRoutePath(path)}` : `/${path}`;
  }
  return result;
}

export function getFullRoute(
  route: string,
  servers: OpenApiServerObject[] | undefined,
  baseUrl: string | BaseUrlFromConstant | BaseUrlFromSpec | undefined,
): string {
  const getBaseUrl = (): string => {
    if (!baseUrl) return '';
    if (isString(baseUrl)) return baseUrl;
    if (baseUrl.getBaseUrlFromSpecification) {
      if (!servers) {
        throw new Error(
          "Orval is configured to use baseUrl from the specifications 'servers' field, but there exist no servers in the specification.",
        );
      }
      const server = servers.at(
        Math.min(baseUrl.index ?? 0, servers.length - 1),
      );
      if (!server) return '';
      if (!server.variables) return server.url;

      let url = server.url;
      const variables = baseUrl.variables;
      for (const variableKey of Object.keys(server.variables)) {
        const variable = server.variables[variableKey];
        if (variables?.[variableKey]) {
          if (
            variable.enum &&
            !variable.enum.some((e) => e == variables[variableKey])
          ) {
            throw new Error(
              `Invalid variable value '${variables[variableKey]}' for variable '${variableKey}' when resolving ${server.url}. Valid values are: ${variable.enum.join(', ')}.`,
            );
          }
          url = url.replaceAll(`{${variableKey}}`, variables[variableKey]);
        } else {
          url = url.replaceAll(`{${variableKey}}`, String(variable.default));
        }
      }
      return url;
    }
    return baseUrl.baseUrl;
  };

  let fullRoute = route;
  const base = getBaseUrl();
  if (base) {
    if (base.endsWith('/') && route.startsWith('/')) {
      fullRoute = route.slice(1);
    }
    fullRoute = `${base}${fullRoute}`;
  }
  return fullRoute;
}

// Creates a mixed use array with path variables and string from template string route
export function getRouteAsArray(route: string): string {
  return route
    .replaceAll(TEMPLATE_TAG_IN_PATH_REGEX, '/$1/${')
    .split('/')
    .filter((i) => i !== '')
    .map((i) =>
      // @note - array is mixed with string and var
      i.includes('${') ? i.replace(TEMPLATE_TAG_REGEX, '$1') : `'${i}'`,
    )
    .join(',')
    .replace(',,', '');
}
