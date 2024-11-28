import { camel, sanitize } from '../utils';
import { TEMPLATE_TAG_REGEX } from '../constants';
import {
  BaseUrlFromConstant,
  BaseUrlFromSpec,
  ContextSpecs,
  NormalizedOutputOptions,
} from '../types';
import { PathItemObject, ServerObject } from 'openapi3-ts/oas31';

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

export const getFullRoute = (
  route: string,
  servers: ServerObject[] | undefined,
  baseUrl: string | BaseUrlFromConstant | BaseUrlFromSpec | undefined,
): string => {
  const getBaseUrl = (): string => {
    if (!baseUrl) return '';
    if (typeof baseUrl === 'string') return baseUrl;
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
        if (!variables?.[variableKey]) {
          url = url.replaceAll(`{${variableKey}}`, String(variable.default));
        } else {
          if (
            variable.enum &&
            !variable.enum.some((e) => e == variables[variableKey])
          ) {
            throw new Error(
              `Invalid variable value '${variables[variableKey]}' for variable '${variableKey}' when resolving ${server.url}. Valid values are: ${variable.enum.join(', ')}.`,
            );
          }
          url = url.replaceAll(`{${variableKey}}`, variables[variableKey]);
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
