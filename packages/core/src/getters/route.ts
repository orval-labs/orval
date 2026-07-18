import jsesc from 'jsesc';

import { TEMPLATE_TAG_REGEX } from '../constants';
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

// Matches a `{name}` path-parameter template and captures the name
// (`{petId}`, `{user_id}`, `{scope.id}`, `{kebab-case}`, `{path*}`). The
// (?<!\$) guard is shared policy for every consumer (template-literal,
// Hono and MSW routes): a `${...}` block in a spec path is never treated
// as an OpenAPI param — it stays literal text in the emitted route. The name
// must be non-empty so a malformed `{}` also stays literal instead of
// emitting an invalid `${}` interpolation.
const PATH_PARAM_REGEX = /(?<!\$)\{([\w.*-]+)\}/g;

// Spec paths are required to start with `/`, but malformed specs without it
// are tolerated by normalizing here.
const ensureLeadingSlash = (path: string): string =>
  path && !path.startsWith('/') ? `/${path}` : path;

/**
 * Sanitizes an OpenAPI path-parameter name while preserving the spec's
 * spelling: keeps word characters, underscores, dashes and dots, strips
 * everything else, and prefixes ES5 keywords with an underscore. Use this
 * when the emitted name must match the spec (e.g. Hono routes).
 */
export const sanitizePathParamName = (name: string): string =>
  sanitize(name, { es5keyword: true, underscore: true, dash: true, dot: true });

/**
 * Derives the generated JS identifier for an OpenAPI path-parameter name
 * (`scope.id` → `scopeId`, `_id` → `id`, `class` → `_class`). This is the
 * single source of truth for param variable names: the emitted route
 * interpolations, the generated function arguments and the spec-parameter
 * matching must all agree on it.
 */
export const camelPathParamName = (name: string): string =>
  sanitize(camel(name), { es5keyword: true });

/**
 * Converts every `{param}` in an OpenAPI path to `:param` (Hono/MSW style
 * routes). `formatParamName` maps the raw OpenAPI parameter name to the
 * emitted one (`sanitizePathParamName` or `camelPathParamName`).
 */
export const toColonRoutePath = (
  path: string,
  formatParamName: (rawName: string) => string,
): string =>
  ensureLeadingSlash(path).replaceAll(
    PATH_PARAM_REGEX,
    (_, name: string) => `:${formatParamName(name)}`,
  );

const esc = (str: string) => jsesc(str, { quotes: 'backtick', wrap: false });

/**
 * Converts an OpenAPI path (`{param}`) to a template-literal route (`${param}`),
 * escaping static text with jsesc for safe embedding in backtick strings.
 * The `route` arg must be a raw OpenAPI path; a non-empty route always emits
 * with a leading `/`.
 */
export function getRoute(route: string) {
  // Splitting on the capture group leaves param names at odd indices and
  // literal text at even indices. `${...}` blocks in the spec path fall into
  // the literal parts (via the lookbehind) so they are escaped, not
  // interpolated.
  return ensureLeadingSlash(route)
    .split(PATH_PARAM_REGEX)
    .map((part, i) => (i % 2 ? `\${${camelPathParamName(part)}}` : esc(part)))
    .join('');
}

/**
 * Prepends a base URL to an already-processed route.
 *
 * `route` must be the output of {@link getRoute} (already escaped for template
 * literals). This function does NOT re-escape it — jsesc is not idempotent, so
 * escaping twice would double the backslashes. Only the server URL from
 * `getBaseUrlFromSpecification` is escaped here, after variable substitution.
 */
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
      if (!server.variables)
        return jsesc(serverUrl, { quotes: 'backtick', wrap: false });

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
      return jsesc(url, { quotes: 'backtick', wrap: false });
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

// Emits a codegen string: wraps each `${param}` segment of a template-literal
// route so the generated client encodes path parameters at request time.
export const wrapRouteParameters = (
  route: string,
  prepend: string,
  append: string,
): string => route.replaceAll(TEMPLATE_TAG_REGEX, `\${${prepend}$1${append}}`);

export const makeRouteSafe = (route: string): string =>
  wrapRouteParameters(route, 'encodeURIComponent(String(', '))');

// Creates a mixed use array with path variables and string from template string route
export function getRouteAsArray(route: string): string {
  return route
    .split('/')
    .filter((i) => i !== '')
    .flatMap((segment) => {
      if (!segment.includes('${')) {
        return [`'${segment.replaceAll("'", "\\'")}'`];
      }
      // Split by template tags, keeping the delimiters.
      // (?<!\\) prevents matching \${...} (jsesc-escaped) as a template tag.
      return segment
        .split(/(?<!\\)(\$\{.+?\})/g)
        .filter(Boolean)
        .map((part) => {
          const match = /^(?<!\\)\$\{(.+?)\}$/.exec(part);
          return match ? match[1] : `'${part.replaceAll("'", "\\'")}'`;
        });
    })
    .join(',');
}
