import type {
  BaseUrlFromConstant,
  BaseUrlFromSpec,
  BaseUrlRuntime,
  GeneratorImport,
  NormalizedOutputOptions,
  OpenApiServerObject,
} from '../types';
import { camel, isObject, isString, sanitize } from '../utils';

function isBaseUrlRuntime(
  baseUrl: string | BaseUrlFromConstant | BaseUrlFromSpec | BaseUrlRuntime,
): baseUrl is BaseUrlRuntime {
  return (
    isObject(baseUrl) &&
    'runtime' in baseUrl &&
    typeof baseUrl.runtime === 'string'
  );
}

/**
 * Wraps a runtime expression for generated URL template literals.
 * Pass the expression only (e.g. `process.env.API_BASE_URL`), not a `${...}` fragment.
 */
function runtimeExpressionToUrlPrefix(expression: string): string {
  const t = expression.trim();
  if (!t) return '';
  return '${' + t + '}';
}

const hasParam = (path: string): boolean => /[^{]*{[\w*_-]*}.*/.test(path);

const getRoutePath = (path: string): string => {
  const matches = /([^{]*){?([\w*_-]*)}?(.*)/.exec(path);
  if (!matches?.length) return path; // impossible due to regexp grouping here, but for TS

  const prev = matches[1];
  const rawParam = matches[2];
  const rest = matches[3];
  const param = sanitize(camel(rawParam), {
    es5keyword: true,
    underscore: true,
    dash: true,
    dot: true,
  });
  const next = hasParam(rest) ? getRoutePath(rest) : rest;

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
  baseUrl:
    | string
    | BaseUrlFromConstant
    | BaseUrlFromSpec
    | BaseUrlRuntime
    | undefined,
): string {
  const getBaseUrl = (): string => {
    if (!baseUrl) return '';
    if (isString(baseUrl)) return baseUrl;
    if (isBaseUrlRuntime(baseUrl)) {
      return runtimeExpressionToUrlPrefix(baseUrl.runtime);
    }
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
      const serverUrl = server.url ?? '';
      if (!server.variables) return serverUrl;

      let url = serverUrl;
      const variables = baseUrl.variables;
      for (const variableKey of Object.keys(server.variables)) {
        const variable = server.variables[variableKey];
        if (variables?.[variableKey]) {
          if (
            variable.enum &&
            !variable.enum.some((e) => e == variables[variableKey])
          ) {
            throw new Error(
              `Invalid variable value '${variables[variableKey]}' for variable '${variableKey}' when resolving ${serverUrl}. Valid values are: ${variable.enum.join(', ')}.`,
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

/**
 * Returns `GeneratorImport` entries for {@link BaseUrlRuntime.imports} when `baseUrl` is a runtime config.
 *
 * Defaults `values` to true so symbols in `runtime` emit as value imports in the
 * generated client. Set `values: false` explicitly only for unusual cases (e.g.
 * type-only symbols referenced from the expression).
 */
export function getBaseUrlRuntimeImports(
  baseUrl?: NormalizedOutputOptions['baseUrl'],
): GeneratorImport[] {
  if (!baseUrl) return [];
  if (!isBaseUrlRuntime(baseUrl)) return [];
  return (baseUrl.imports ?? []).map((imp) => ({
    ...imp,
    values: imp.values ?? true,
  }));
}

// Creates a mixed use array with path variables and string from template string route
export function getRouteAsArray(route: string): string {
  return route
    .split('/')
    .filter((i) => i !== '')
    .flatMap((segment) => {
      if (!segment.includes('${')) {
        return [`'${segment}'`];
      }
      // Split by template tags, keeping the delimiters
      return segment
        .split(/(\$\{.+?\})/g)
        .filter(Boolean)
        .map((part) => {
          const match = /^\$\{(.+?)\}$/.exec(part);
          return match ? match[1] : `'${part}'`;
        });
    })
    .join(',');
}
