import jsesc from 'jsesc';

import type {
  BaseUrlFromConstant,
  BaseUrlFromSpec,
  BaseUrlRuntime,
  GeneratorImport,
  NormalizedOutputOptions,
  OpenApiServerObject,
  VariableRuntimeValue,
} from '../types';
import {
  camel,
  isObject,
  isString,
  mapTemplateExpressions,
  parseTemplateLiteral,
  sanitize,
} from '../utils';

function isBaseUrlRuntime(
  baseUrl: string | BaseUrlFromConstant | BaseUrlFromSpec | BaseUrlRuntime,
): baseUrl is BaseUrlRuntime {
  return (
    isObject(baseUrl) &&
    'runtime' in baseUrl &&
    typeof baseUrl.runtime === 'string'
  );
}

function isVariableRuntimeValue(
  value: string | VariableRuntimeValue | undefined,
): value is VariableRuntimeValue {
  return isObject(value) && 'runtime' in value;
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

/**
 * One piece of an OpenAPI path, in the spec's own vocabulary: either static
 * text (raw and unescaped) or a `{name}` path parameter. Every route emitted
 * by orval is built from these tokens, so the decision "is this a parameter?"
 * is made exactly once, against the spec path, and never re-derived from the
 * generated source afterwards (#3703).
 */
export type RouteToken =
  | { kind: 'literal'; value: string }
  | { kind: 'param'; name: string };

// Matches a `{name}` path-parameter template and captures the name
// (`{petId}`, `{user_id}`, `{scope.id}`, `{kebab-case}`, `{path*}`). Sticky:
// it is only ever applied at a known `{`.
const PATH_PARAM_NAME_REGEX = /\{([\w.*-]+)\}/y;

/**
 * Tokenizes an OpenAPI path into static text and `{name}` parameters.
 *
 * Two lexing rules keep spec content from turning into generated syntax:
 *
 * - A `$` immediately followed by `{` consumes both characters as static text,
 *   so a `${...}` block written in a spec path is never read as a parameter.
 *   This is shared policy for every consumer (template-literal, Hono and MSW
 *   routes) and the reason `/v1/some${petId}/path` cannot smuggle an
 *   interpolation into the generated client.
 * - A `{` that is not followed by a non-empty `[\w.*-]+}` name is static text,
 *   so a malformed `{}` stays literal instead of emitting an invalid `${}`.
 */
export const parseRoutePath = (path: string): RouteToken[] => {
  const tokens: RouteToken[] = [];
  let literal = '';
  let index = 0;

  const flushLiteral = () => {
    if (literal) {
      tokens.push({ kind: 'literal', value: literal });
      literal = '';
    }
  };

  while (index < path.length) {
    const char = path[index];

    // `${` is static text, never a parameter: consume both characters so the
    // `{` cannot start a parameter on the next iteration.
    if (char === '$' && path[index + 1] === '{') {
      literal += '${';
      index += 2;
      continue;
    }

    if (char === '{') {
      PATH_PARAM_NAME_REGEX.lastIndex = index;
      const match = PATH_PARAM_NAME_REGEX.exec(path);
      if (match) {
        flushLiteral();
        tokens.push({ kind: 'param', name: match[1] });
        index += match[0].length;
        continue;
      }
    }

    literal += char;
    index++;
  }

  flushLiteral();
  return tokens;
};

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
  parseRoutePath(ensureLeadingSlash(path))
    .map((token) =>
      token.kind === 'param' ? `:${formatParamName(token.name)}` : token.value,
    )
    .join('');

const esc = (str: string) => jsesc(str, { quotes: 'backtick', wrap: false });

/**
 * Converts an OpenAPI path (`{param}`) to a template-literal route (`${param}`),
 * escaping static text with jsesc for safe embedding in backtick strings.
 * The `route` arg must be a raw OpenAPI path; a non-empty route always emits
 * with a leading `/`.
 */
export function getRoute(route: string) {
  // Serialize the token stream: static text is escaped for a backtick string,
  // parameters become interpolations. Because the two are produced from
  // separate tokens, escaped static text can never be mistaken for an
  // interpolation (or vice versa) by a later pass.
  return parseRoutePath(ensureLeadingSlash(route))
    .map((token) =>
      token.kind === 'param'
        ? `\${${camelPathParamName(token.name)}}`
        : esc(token.value),
    )
    .join('');
}

/**
 * Resolves a concrete base URL from an OpenAPI specification's `servers`
 * field, applying the same `index`/`variables` selection semantics as
 * `BaseUrlFromSpec`.
 *
 * Unlike `getFullRoute`'s `BaseUrlFromSpec` handling, this returns `''` when
 * `servers` is missing or empty instead of throwing — callers that want a
 * relative-URL fallback (e.g. the Angular DI base-url token) can use this
 * directly, while `getFullRoute` still throws for its own
 * `getBaseUrlFromSpecification` path to preserve existing behavior.
 *
 * The returned value is NOT escaped for embedding in a template literal —
 * callers that splice it into generated backtick source (e.g. `getFullRoute`)
 * must escape it themselves; callers that embed it via `JSON.stringify`
 * (e.g. the Angular DI base-url token file) should use the raw value as-is.
 */
const VARIABLE_MARKER_PREFIX = '__ORVAL_RT_';

/** Deterministic djb2 hash so markers are opaque yet stable across runs. */
function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/**
 * Collision-resistant opaque marker for a runtime server variable. The hash
 * of the full server URL plus the variable key makes accidental matches with
 * literal URL text practically impossible, while staying deterministic so
 * generated output (and snapshots) never churn between runs.
 */
function runtimeVariableMarker(serverUrl: string, variableKey: string): string {
  return `${VARIABLE_MARKER_PREFIX}${hashString(serverUrl + variableKey)}__`;
}

export function resolveServerUrl(
  servers: OpenApiServerObject[] | undefined,
  options: {
    index?: number;
    variables?: Record<string, string | VariableRuntimeValue>;
  },
): string {
  if (!servers || servers.length === 0) return '';

  const server = servers.at(Math.min(options.index ?? 0, servers.length - 1));
  if (!server) return '';
  const serverUrl = server.url ?? '';
  if (!server.variables) return serverUrl;

  let url = serverUrl;
  const variables = options.variables;

  // Phase 1: replace ALL `{key}` placeholders with opaque collision-resistant
  // markers so later variable substitutions cannot interfere with one another,
  // and literal marker-like text in static values cannot collide (#3916).
  const staticMarkers = new Map<string, string>();
  for (const variableKey of Object.keys(server.variables)) {
    const variable = server.variables[variableKey];
    const raw = variables?.[variableKey];
    const marker = runtimeVariableMarker(serverUrl, variableKey);
    if (isVariableRuntimeValue(raw)) {
      url = url.replaceAll(`{${variableKey}}`, marker);
    } else {
      if (
        raw !== undefined &&
        variable.enum &&
        !variable.enum.some((e) => e == raw)
      ) {
        throw new Error(
          `Invalid variable value '${raw}' for variable '${variableKey}' when resolving ${serverUrl}. Valid values are: ${variable.enum.join(', ')}.`,
        );
      }
      const resolved =
        raw !== undefined ? String(raw) : String(variable.default);
      url = url.replaceAll(`{${variableKey}}`, marker);
      staticMarkers.set(marker, resolved);
    }
  }

  // Phase 2: substitute static markers with actual values. Runtime markers
  // remain in the URL; callers restore them as `${expr}` after escaping.
  for (const [marker, value] of staticMarkers) {
    url = url.replaceAll(marker, value);
  }

  return url;
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
      const selectedServer =
        servers.at(Math.min(baseUrl.index ?? 0, servers.length - 1)) ??
        servers[0];
      // `resolveServerUrl` returns the raw (unescaped) URL; escape it here
      // for safe embedding in the generated backtick template literal.
      let base = esc(
        resolveServerUrl(servers, {
          index: baseUrl.index,
          variables: baseUrl.variables,
        }),
      );
      // `{ runtime: ... }` variables were replaced with opaque markers by
      // `resolveServerUrl`; restore them as `${expr}` interpolations now,
      // after escaping, so the expression itself is never escaped (#3734).
      // Markers are deterministic (hash of server URL + key), so recompute
      // them here to restore only what `resolveServerUrl` actually emitted.
      if (baseUrl.variables && selectedServer?.url) {
        for (const [key, value] of Object.entries(baseUrl.variables)) {
          if (isVariableRuntimeValue(value)) {
            base = base.replaceAll(
              runtimeVariableMarker(selectedServer.url, key),
              `\${${value.runtime}}`,
            );
          }
        }
      }
      return base;
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
// `skip` lists param names to leave unwrapped (e.g. `allowReserved: true`
// wildcard params that must keep their `/`).
export const wrapRouteParameters = (
  route: string,
  prepend: string,
  append: string,
  skip: Set<string> = new Set(),
): string =>
  mapTemplateExpressions(route, (name) => {
    // Angular's httpResource rewrites `${param}` to `${param()}`,
    // `${param?.() ?? default}`, `${pathParams().param}` or
    // `${pathParams()?.param ?? default}` before this runs; normalize the
    // expression to the bare param name so the skip set (keyed on the bare
    // name) still matches.
    const key = name
      .replace(/^pathParams\(\)\?\./, '')
      .replace(/^pathParams\(\)\./, '')
      .replace(/\?\.\(\)\s*\?\?.*$/, '')
      .replace(/\s*\?\?.*$/, '')
      .replace(/\(\)$/, '')
      .replace(/[()?]/g, '')
      .trim();
    return skip.has(key) ? name : `${prepend}${name}${append}`;
  });

export const makeRouteSafe = (
  route: string,
  skip: Set<string> = new Set(),
): string =>
  wrapRouteParameters(route, 'encodeURIComponent(String(', '))', skip);

/**
 * Turns a template-literal route into the comma-separated query-key segments
 * used by the Vue/split-query-key generators: `/pets/${petId}/tags` becomes
 * `'pets',petId,'tags'`.
 *
 * The route is tokenized first and split on `/` only inside static text, so a
 * `/` appearing inside an interpolation (a runtime `baseUrl` expression such as
 * `${process.env.API ?? 'http://localhost'}`) does not tear the expression
 * apart, and an escaped `\${...}` stays a literal segment.
 */
export function getRouteAsArray(route: string): string {
  const entries: string[] = [];

  // Static text is kept in its escaped backtick-source form and re-wrapped in
  // single quotes: every escape jsesc emits in backtick mode (backslash,
  // backtick, dollar-brace and control characters) is also valid inside a
  // single-quoted string, so only `'` itself needs escaping here. Empty chunks
  // (leading, trailing or doubled slashes) contribute no segment.
  const pushLiteral = (value: string) => {
    if (value) entries.push(`'${value.replaceAll("'", String.raw`\'`)}'`);
  };

  for (const part of parseTemplateLiteral(route)) {
    if (part.kind === 'expression') {
      entries.push(part.source);
      continue;
    }

    let chunk = '';
    let index = 0;
    while (index < part.source.length) {
      const char = part.source[index];
      // Consume escapes as a unit so a `\/` (were jsesc ever to emit one)
      // is not mistaken for a segment separator.
      if (char === '\\') {
        chunk += part.source.slice(index, index + 2);
        index += 2;
        continue;
      }
      if (char === '/') {
        pushLiteral(chunk);
        chunk = '';
        index++;
        continue;
      }
      chunk += char;
      index++;
    }
    pushLiteral(chunk);
  }

  return entries.join(',');
}
