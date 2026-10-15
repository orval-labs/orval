import fs from 'node:fs';
import path from 'node:path';

import { generateDependencyImports } from '../generators';
import type {
  ContextSpec,
  GeneratorImport,
  NormalizedOutputOptions,
  WriteSpecBuilder,
} from '../types';
import {
  assertSafeResponseStatusKey,
  getImportExtension,
  logger,
} from '../utils';
import { writeGeneratedFile } from './file';
import { generateImportsForBuilder } from './generate-imports-for-builder';
import { getFakerEntry, getMockDir } from './mock-utils';
import {
  getManifestOperations,
  getOperationManifestEntry,
  getOperationManifestTypes,
  getSchemasImportPathFrom,
  getTargetFileInfo,
} from './operation-manifest';

/** One route of the fixtures file, e.g. `GET /pets/:petId`. */
export interface FixtureRouteEntry {
  route: string;
  /** The operation that serves the route. */
  operation: string;
  method: string;
  /** The URL path with `:param` placeholders. */
  path: string;
  /** The `get<Op>ResponseMock` factory, when the faker generator emits one. */
  mock: string | null;
  status: number;
  /** Faker seed for the route's mock, fixed at generation time. */
  seed: number;
  /** Path params by generated key, in path order. */
  params: string[];
  /** The path params' types, e.g. `{ petId: number }`, or `never`. */
  pathParams: string;
  /** The query params' type, or `never`. */
  query: string;
  body: string;
  response: string;
  /** The error response's type, or `unknown`. */
  error: string;
  imports: GeneratorImport[];
}

/** FNV-1a: a stable 32-bit seed per route. */
const seedFor = (text: string) => {
  let hash = 0x81_1c_9d_c5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.codePointAt(index) ?? 0;
    hash = Math.imul(hash, 0x01_00_01_93);
  }
  return hash >>> 0;
};

/** The status a success response key answers with: `default` is 200, `2XX` is 200. */
const successStatus = (key: string | undefined) => {
  if (key === undefined || key === 'default') return 200;
  return /^[1-5]XX$/i.test(key)
    ? Number(key[0]) * 100
    : Number(assertSafeResponseStatusKey(key));
};

/** Every operation's route, keyed by `<METHOD> <path>` with `:param` placeholders. */
export function getFixtureRoutes(
  builder: Pick<
    WriteSpecBuilder,
    'operations' | 'verbOptions' | 'operationVerbOptions' | 'spec' | 'target'
  >,
  output: NormalizedOutputOptions,
): FixtureRouteEntry[] {
  const context: ContextSpec = {
    spec: builder.spec,
    target: builder.target,
    workspace: '',
    output,
  };

  const routes = new Map<string, FixtureRouteEntry>();
  for (const { verbOptions, operation } of getManifestOperations(
    builder,
    'Fixtures',
  )) {
    const entry = getOperationManifestEntry(verbOptions, operation, context);
    const { route } = entry;
    if (routes.has(route)) {
      logger.warn(
        `Fixtures: "${route}" is served by more than one operation, keeping the first one.`,
      );
      continue;
    }
    const types = getOperationManifestTypes(verbOptions);
    routes.set(route, {
      route,
      operation: entry.operationName,
      method: entry.method,
      path: route.slice(route.indexOf(' ') + 1),
      mock: entry.mock,
      status: successStatus(verbOptions.response.types.success[0]?.key),
      seed: seedFor(route),
      params: entry.pathParams.map((p) => p.key),
      pathParams: types.pathParams,
      query: types.query,
      body: types.body,
      response: types.response,
      error: types.error,
      imports: types.imports,
    });
  }
  return [...routes.values()].toSorted((a, b) =>
    a.route.localeCompare(b.route),
  );
}

const renderRoutes = (routes: FixtureRouteEntry[]) => {
  const lines = routes.map(
    ({ route, operation, mock, status, seed }) =>
      `  ${JSON.stringify(route)}: { operation: ${JSON.stringify(operation)}, mock: ${mock ?? 'null'}, status: ${status}, seed: ${seed} },`,
  );
  return `const routes: Record<string, { operation: string; mock: (() => unknown) | null; status: number; seed: number }> = {
${lines.join('\n')}
};
`;
};

const renderTypes = (routes: FixtureRouteEntry[]) => {
  const lines = routes.map(
    (entry) =>
      `  ${JSON.stringify(entry.route)}: {\n` +
      `    operation: ${JSON.stringify(entry.operation)};\n` +
      `    method: ${JSON.stringify(entry.method)};\n` +
      `    path: ${JSON.stringify(entry.path)};\n` +
      `    params: ${entry.params.length > 0 ? `{ ${entry.params.map((key) => `${JSON.stringify(key)}: string`).join('; ')} }` : 'Record<string, never>'};\n` +
      `    pathParams: ${entry.pathParams};\n` +
      `    query: ${entry.query};\n` +
      `    body: ${entry.body};\n` +
      `    response: ${entry.response};\n` +
      `    error: ${entry.error};\n` +
      `    mocked: ${entry.mock ? 'true' : 'false'};\n` +
      `  };`,
  );
  const operations = routes.map(
    ({ route, operation }) =>
      `  ${JSON.stringify(operation)}: ${JSON.stringify(route)};`,
  );
  return `/**
 * Every route in the spec: its operation, method and path, the params a fixture function
 * receives (as strings, from the URL), the spec's path and query params, and its body,
 * response and error types. \`mocked\` routes default to their mock.
 */
export type FixtureRoutes = {
${lines.join('\n')}
};

/** The route of every operation. */
export type FixtureOperations = {
${operations.join('\n')}
};
`;
};

// The runtime half of the fixtures file. It only depends on the generated
// `routes`, `FixtureRoutes` and `FixtureOperations` above it.
const HELPERS = `
type FixtureMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/** A route in the spec, e.g. \`"GET /pets/:petId"\`. */
export type FixtureRoute = keyof FixtureRoutes;

/** An operation in the spec, e.g. \`"showPetById"\`. */
export type FixtureOperation = keyof FixtureOperations;

/** A route or its operation. */
export type FixtureKey = FixtureRoute | FixtureOperation;

/** A fixture map key: a route, a route with a \`?name=value\` query constraint, or an operation. */
export type FixtureMapKey = FixtureKey | \`\${FixtureRoute}?\${string}\`;

/** The route a key names. */
export type RouteOf<K extends FixtureMapKey> = K extends FixtureOperation
  ? FixtureOperations[K]
  : K extends \`\${infer R extends FixtureRoute}?\${string}\`
    ? R
    : Extract<K, FixtureRoute>;

/** Every field optional, recursively. Arrays are replaced whole. */
export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

export interface FixtureRequest<Params = Record<string, string>, Body = unknown> {
  method: string;
  url: URL;
  /** Path params by name, as strings. */
  params: Params;
  body: Body | undefined;
}

const RESPONSE: unique symbol = Symbol('orval.fixtureResponse');

/** An exact status, body and headers. Create it with {@link respond}. */
export interface FixtureResponse<B = unknown> {
  readonly [RESPONSE]: true;
  status: number;
  body?: B;
  headers?: Record<string, string>;
}

/**
 * Answers with this status, body and headers instead of the route's mock. In a fixture, the
 * body must be the route's response or error type.
 */
export const respond = <B = undefined>(
  status: number,
  body?: B,
  headers?: Record<string, string>,
): FixtureResponse<B> => ({
  [RESPONSE]: true,
  status,
  ...(body === undefined ? {} : { body }),
  ...(headers ? { headers } : {}),
});

type FixtureBody<R extends FixtureRoute> = FixtureRoutes[R]['mocked'] extends true
  ? DeepPartial<FixtureRoutes[R]['response']>
  : FixtureRoutes[R]['response'];

type FixtureRouteResponse<R extends FixtureRoute> = FixtureResponse<
  FixtureRoutes[R]['response'] | FixtureRoutes[R]['error'] | undefined
>;

/**
 * A route's fixture: its response body (deep-merged onto the route's mock when it
 * has one, \`undefined\` for the mock as is), a {@link respond} result, or a
 * function of the request returning either.
 */
export type FixtureValue<R extends FixtureRoute> =
  | FixtureBody<R>
  | FixtureRouteResponse<R>
  | ((
      request: FixtureRequest<FixtureRoutes[R]['params'], FixtureRoutes[R]['body']>,
    ) => FixtureBody<R> | FixtureRouteResponse<R>);

/** Fixtures by route or operation. A \`?name=value\` suffix only matches requests with that query. */
export type Fixtures = { [R in FixtureRoute]?: FixtureValue<R> | undefined } & {
  [R in FixtureRoute as \`\${R}?\${string}\`]?: FixtureValue<R> | undefined;
} & { [O in FixtureOperation]?: FixtureValue<FixtureOperations[O]> | undefined };

/** Fixtures by route or operation, for the keys \`K\` (inferred from the object's keys). */
export type FixtureMap<K extends FixtureMapKey> = {
  [P in K]?: FixtureValue<RouteOf<P>> | undefined;
};

/** Fixtures for routes the spec doesn't describe. Nothing about them is checked. */
export type UntypedFixtures = Record<\`\${FixtureMethod} /\${string}\`, unknown>;

export interface FixtureOptions {
  untyped?: UntypedFixtures;
  /** Added to every route's seed: different mock values, still the same on every run. */
  seed?: number;
}

export interface FixtureResult {
  /** The fixture key that answered. */
  route: string;
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

/** A fixture's reply: the route's response when \`ok\` (2xx), its error otherwise. */
export type FixtureReply<R extends FixtureRoute> =
  | {
      ok: true;
      status: number;
      body: FixtureRoutes[R]['response'];
      headers?: Record<string, string>;
    }
  | {
      ok: false;
      status: number;
      body: FixtureRoutes[R]['error'];
      headers?: Record<string, string>;
    };

type FixtureQueryArgs<R extends FixtureRoute> = [FixtureRoutes[R]['query']] extends [never]
  ? []
  : [query?: FixtureRoutes[R]['query']];

/** \`url\`'s arguments: the path params when the route has any, then its query params. */
export type FixtureUrlArgs<R extends FixtureRoute> = [FixtureRoutes[R]['pathParams']] extends [never]
  ? FixtureQueryArgs<R>
  : [params: FixtureRoutes[R]['pathParams'], ...FixtureQueryArgs<R>];

/**
 * The request a fixture replies to: the real request's \`url\`, or the \`params\` and \`query\`
 * to build one from. Without either, each path param is its own name.
 */
export type FixtureReplyRequest<R extends FixtureRoute> = {
  body?: FixtureRoutes[R]['body'];
} & (
  | { url: string | URL }
  | {
      params?: FixtureRoutes[R]['pathParams'];
      query?: FixtureRoutes[R]['query'];
    }
);

/** One endpoint's fixture, for whatever intercepts the request: nock, MSW, a fetch stub. */
export interface Fixture<R extends FixtureRoute = FixtureRoute> {
  /** Its key in a set: the route, plus its query constraint. */
  readonly key: string;
  /** \`"GET /pets/:petId"\` */
  readonly route: R;
  /** \`"showPetById"\` */
  readonly operation: FixtureRoutes[R]['operation'];
  /** \`"GET"\` */
  readonly method: FixtureRoutes[R]['method'];
  /** \`"/pets/:petId"\`, in the path syntax of MSW, Express and the like. */
  readonly path: FixtureRoutes[R]['path'];
  /** The query params a request must have. */
  readonly query: Readonly<Record<string, string>>;
  /** Matches the route's paths, with or without a query string. */
  readonly pattern: RegExp;
  /** The fixture's value, as given. */
  readonly value: FixtureValue<R> | undefined;
  /** The URL of a request for this fixture, e.g. \`url({ petId: 1 })\` is \`"/pets/1"\`. */
  url(...args: FixtureUrlArgs<R>): string;
  /** Whether a request is for this fixture: its method, path and query. */
  matches(request: { method: string; url: string | URL }): boolean;
  /** The reply to a request: the route's seeded mock with the fixture on top. */
  reply(request?: FixtureReplyRequest<R>): FixtureReply<R>;
  /** A new fixture with \`overrides\` on top. Bodies deep-merge, anything else replaces. */
  with(overrides: FixtureValue<R>): Fixture<R>;
}

/** Any route's fixture. */
// oxlint-disable-next-line typescript/no-explicit-any
export type AnyFixture = Fixture<any>;

/** The fixtures for some keys: \`Fixture<A> | Fixture<B>\`. */
export type FixtureOf<K extends FixtureMapKey> = K extends FixtureMapKey ? Fixture<RouteOf<K>> : never;

/** The fixtures \`defineFixtures\` and \`extend\` add: the list's, else the map's. */
type FixturesFrom<F extends AnyFixture, K extends FixtureMapKey> = [F] extends [never]
  ? FixtureOf<K>
  : F;

/** A set's reply: the fixture that answered and its reply. Narrow it on \`route\`. */
export type FixtureSetReply<F extends AnyFixture> = F extends Fixture<infer R>
  ? FixtureReply<R> & { route: R; key: string; fixture: Fixture<R> }
  : never;

/**
 * Fixtures for many endpoints, typed by the fixtures in it. Iterating yields its typed
 * fixtures, most specific first.
 */
export interface FixtureSet<F extends AnyFixture = AnyFixture> extends Iterable<F> {
  /** Values by key, as given. */
  readonly fixtures: Readonly<Record<string, unknown>>;
  readonly seed: number;
  /** The fixture for a route or operation in the set, without a query constraint. */
  get<K extends F['route'] | F['operation']>(key: K): Fixture<RouteOf<K>>;
  /** Answers a request from the most specific matching fixture, or \`undefined\` when none matches. */
  reply(request: { method: string; url: string | URL; body?: unknown }): FixtureSetReply<F> | undefined;
  /** A new set with \`fixtures\` on top. Bodies of the same key deep-merge, anything else replaces. */
  extend<G extends AnyFixture = never, const K extends FixtureMapKey = never>(
    fixtures: readonly G[] | FixtureMap<K>,
    options?: FixtureOptions,
  ): FixtureSet<F | FixturesFrom<G, K>>;
}

const isResponse = (value: unknown): value is FixtureResponse =>
  typeof value === 'object' && value !== null && RESPONSE in value;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !isResponse(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

/** Objects merge; arrays, \`null\` and primitives replace; \`undefined\` keeps \`base\`. */
const merge = (base: unknown, override: unknown): unknown => {
  if (override === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(override)) return override;
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    merged[key] = merge(base[key], value);
  }
  return merged;
};

const routeOfOperation: Record<string, string> = Object.fromEntries(
  Object.entries(routes).map(([route, { operation }]) => [operation, route]),
);

/** The key with an operation replaced by its route. */
const toKey = (key: string) => {
  const queryStart = key.indexOf('?');
  const head = queryStart === -1 ? key : key.slice(0, queryStart);
  return (routeOfOperation[head] ?? head) + (queryStart === -1 ? '' : key.slice(queryStart));
};

/** Query params as a search string. Arrays repeat the name; \`null\` and \`undefined\` are left out. */
const toSearch = (query: object = {}) =>
  new URLSearchParams(
    Object.entries(query).flatMap(([name, value]: [string, unknown]) =>
      value === undefined || value === null
        ? []
        : (Array.isArray(value) ? value : [value]).map((item) => [name, String(item)]),
    ),
  ).toString();

interface CompiledFixture {
  key: string;
  route: string;
  method: string;
  /** \`null\` for a param segment. */
  segments: (string | null)[];
  params: string[];
  query: [string, string][];
}

const compileKey = (key: string): CompiledFixture => {
  const queryStart = key.indexOf('?');
  const route = queryStart === -1 ? key : key.slice(0, queryStart);
  const space = route.indexOf(' ');
  const parts = route.slice(space + 1).split('/').filter(Boolean);
  return {
    key,
    route,
    method: route.slice(0, space).toUpperCase(),
    segments: parts.map((part) => (part.startsWith(':') ? null : part)),
    params: parts.filter((part) => part.startsWith(':')).map((part) => part.slice(1)),
    query: [...new URLSearchParams(queryStart === -1 ? '' : key.slice(queryStart + 1))],
  };
};

/**
 * At the first position where one route has a literal segment and the other a
 * param, the literal wins. Then more query constraints beat fewer.
 */
const bySpecificity = (a: CompiledFixture, b: CompiledFixture) => {
  for (let index = 0; index < Math.min(a.segments.length, b.segments.length); index++) {
    const aLiteral = a.segments[index] !== null;
    if (aLiteral !== (b.segments[index] !== null)) return aLiteral ? -1 : 1;
  }
  return b.query.length - a.query.length;
};

/** The decoded path segment, or the raw one when its percent-encoding is malformed. */
const decodeSegment = (segment: string) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

const toUrl = (url: string | URL) => new URL(url, 'http://localhost');

/** The path params of a request for \`candidate\`, or \`undefined\` when it isn't one. */
const match = (
  candidate: CompiledFixture,
  method: string,
  url: URL,
): Record<string, string> | undefined => {
  const parts = url.pathname.split('/').filter(Boolean).map(decodeSegment);
  if (
    candidate.method !== method.toUpperCase() ||
    candidate.segments.length !== parts.length ||
    !candidate.segments.every((segment, index) => segment === null || segment === parts[index]) ||
    !candidate.query.every(([name, value]) => url.searchParams.get(name) === value)
  ) {
    return undefined;
  }
  const values = parts.filter((_, index) => candidate.segments[index] === null);
  return Object.fromEntries(candidate.params.map((name, index) => [name, values[index] ?? '']));
};

/** A matched request's result: a \`respond()\` as is, else the body on the route's seeded mock. */
const answer = (
  candidate: CompiledFixture,
  fixture: unknown,
  request: FixtureRequest,
  seed: number,
): FixtureResult => {
  const value =
    typeof fixture === 'function' ? (fixture as (request: FixtureRequest) => unknown)(request) : fixture;
  if (isResponse(value)) {
    return {
      route: candidate.key,
      status: value.status,
      body: value.body,
      ...(value.headers ? { headers: value.headers } : {}),
    };
  }
  const defaults = routes[candidate.route];
  if (!defaults?.mock) {
    return { route: candidate.key, status: defaults?.status ?? 200, body: value };
  }
  faker.seed(defaults.seed + seed);
  return { route: candidate.key, status: defaults.status, body: merge(defaults.mock(), value) };
};

const toReply = ({ status, body, headers }: FixtureResult) => ({
  ok: status >= 200 && status < 300,
  status,
  body,
  ...(headers ? { headers } : {}),
});

const escapeRegExp = (text: string) => text.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');

const createFixture = (key: string, value: unknown, seed: number): AnyFixture => {
  const candidate = compileKey(key);
  const { route, method } = candidate;
  const path = route.slice(route.indexOf(' ') + 1);
  const segments = path.split('/');
  const query = Object.fromEntries(candidate.query);
  const build = (params: Record<string, unknown> = {}, extra: object = {}) => {
    const pathname = segments
      .map((segment) => {
        if (!segment.startsWith(':')) return segment;
        const param = params[segment.slice(1)];
        if (param === undefined) throw new Error(\`\${route} needs the \${segment.slice(1)} param\`);
        return encodeURIComponent(String(param));
      })
      .join('/');
    const search = toSearch({ ...query, ...extra });
    return search ? \`\${pathname}?\${search}\` : pathname;
  };
  const placeholders = Object.fromEntries(candidate.params.map((name) => [name, name]));
  return {
    key,
    route,
    operation: routes[route]?.operation,
    method,
    path,
    query,
    pattern: new RegExp(
      \`^\${segments
        .map((segment) => (segment.startsWith(':') ? '[^/]+' : escapeRegExp(segment)))
        .join('/')}(?:\\\\?.*)?$\`,
    ),
    value,
    url: (...args: unknown[]) =>
      candidate.params.length > 0
        ? build(args[0] as Record<string, unknown>, args[1] as object)
        : build({}, args[0] as object),
    matches: (request: { method: string; url: string | URL }) =>
      match(candidate, request.method, toUrl(request.url)) !== undefined,
    reply: (request: { url?: string | URL; params?: Record<string, unknown>; query?: object; body?: unknown } = {}) => {
      const url = toUrl(request.url ?? build(request.params ?? placeholders, request.query));
      const params = match(candidate, method, url);
      if (!params) throw new Error(\`\${key} doesn't match \${method} \${url.pathname}\${url.search}\`);
      return toReply(answer(candidate, value, { method, url, params, body: request.body }, seed));
    },
    with: (overrides: unknown) => createFixture(key, merge(value, overrides), seed),
  } as AnyFixture;
};

/** \`defineFixture\`'s options: the query params a request must have, any of the route's. */
type DefineFixtureOptions<R extends FixtureRoute> = {
  query?: Partial<FixtureRoutes[R]['query']>;
};

/**
 * One endpoint's fixture, by route or operation. A route with a mock takes a deep partial
 * of its response, or nothing for the mock as is.
 */
export const defineFixture = <K extends FixtureKey>(
  key: K,
  ...[value, options]: FixtureRoutes[RouteOf<K>]['mocked'] extends true
    ? [value?: FixtureValue<RouteOf<K>>, options?: DefineFixtureOptions<RouteOf<K>>]
    : [value: FixtureValue<RouteOf<K>>, options?: DefineFixtureOptions<RouteOf<K>>]
): Fixture<RouteOf<K>> => {
  const search = toSearch(options?.query);
  return createFixture(toKey(key) + (search ? \`?\${search}\` : ''), value, 0) as Fixture<RouteOf<K>>;
};

const compiledSets = new WeakMap<FixtureSet, CompiledFixture[]>();

const compile = (set: FixtureSet): CompiledFixture[] => {
  const cached = compiledSets.get(set);
  if (cached) return cached;
  const compiled = Object.keys(set.fixtures).map(compileKey).sort(bySpecificity);
  compiledSets.set(set, compiled);
  return compiled;
};

/**
 * Answers a request from \`set\`, or returns \`undefined\` when no fixture matches.
 * A route with a mock answers with the seeded mock, the fixture merged on top.
 */
export const resolveFixture = (
  set: FixtureSet,
  request: { method: string; url: string | URL; body?: unknown },
): FixtureResult | undefined => {
  const url = toUrl(request.url);
  const method = request.method.toUpperCase();
  for (const candidate of compile(set)) {
    const params = match(candidate, method, url);
    if (params) {
      return answer(candidate, set.fixtures[candidate.key], { method, url, params, body: request.body }, set.seed);
    }
  }
  return undefined;
};

const createSet = (fixtures: Record<string, unknown>, seed: number): FixtureSet => {
  const set: FixtureSet = {
    fixtures,
    seed,
    // Most specific first, for libraries that take the first matching handler.
    *[Symbol.iterator]() {
      for (const { key, route } of compile(set)) {
        if (route in routes) yield createFixture(key, fixtures[key], seed);
      }
    },
    get: (key: string) => {
      const route = toKey(key);
      if (!(route in fixtures)) throw new Error(\`The set has no fixture for \${key}\`);
      return createFixture(route, fixtures[route], seed);
    },
    reply: (request) => {
      const result = resolveFixture(set, request);
      if (!result) return undefined;
      const fixture = createFixture(result.route, fixtures[result.route], seed);
      return { ...toReply(result), route: fixture.route, key: result.route, fixture } as FixtureSetReply<AnyFixture>;
    },
    extend: ((next: readonly AnyFixture[] | Fixtures, options: FixtureOptions = {}) => {
      const entries: [string, unknown][] = Array.isArray(next)
        ? next.map((fixture: AnyFixture) => [fixture.key, fixture.value])
        : Object.entries(next).map(([key, value]) => [toKey(key), value]);
      const merged = { ...fixtures };
      for (const [key, value] of [...entries, ...Object.entries(options.untyped ?? {})]) {
        merged[key] = merge(merged[key], value);
      }
      return createSet(merged, options.seed ?? seed);
    }) as FixtureSet['extend'],
  };
  return set;
};

/**
 * Fixtures for many endpoints, from a list of fixtures or a map by route or operation,
 * checked against the spec.
 */
export const defineFixtures = <F extends AnyFixture = never, const K extends FixtureMapKey = never>(
  fixtures: readonly F[] | FixtureMap<K>,
  options?: FixtureOptions,
): FixtureSet<FixturesFrom<F, K>> => createSet({}, 0).extend(fixtures as never, options) as never;
`;

/**
 * Builds the fixtures file's content.
 *
 * @param fakerImportPath Where the `get<Op>ResponseMock` factories are exported.
 * @param relativeSchemasPath Where the schema types are imported from.
 */
export function buildFixtures(
  builder: Pick<
    WriteSpecBuilder,
    | 'operations'
    | 'verbOptions'
    | 'operationVerbOptions'
    | 'spec'
    | 'target'
    | 'schemaTagMap'
    | 'schemaOutputPlan'
  >,
  output: NormalizedOutputOptions,
  {
    header,
    filePath,
    fakerImportPath,
    relativeSchemasPath,
  }: {
    header: string;
    filePath: string;
    fakerImportPath: string;
    relativeSchemasPath: string;
  },
): string {
  const routes = getFixtureRoutes(builder, output);
  const locale = getFakerEntry(output.mock)?.locale;
  const mocks = routes.flatMap(({ mock }) => (mock ? [mock] : []));

  const implementation = `${renderRoutes(routes)}\n${renderTypes(routes)}${HELPERS}`;
  const typeImports = generateDependencyImports(
    implementation,
    generateImportsForBuilder(
      output,
      routes.flatMap(({ imports }) => imports),
      relativeSchemasPath,
      builder.schemaTagMap,
      builder.schemaOutputPlan,
      filePath,
    ),
    undefined,
    !!output.schemas,
    false,
  );

  return [
    header,
    `import { faker } from '${locale ? `@faker-js/faker/locale/${locale}` : '@faker-js/faker'}';\n`,
    mocks.length > 0
      ? `import { ${mocks.join(', ')} } from '${fakerImportPath}';\n`
      : '',
    typeImports ? `${typeImports}\n` : '',
    `\n${implementation}`,
  ].join('');
}

/**
 * Writes `index.fixtures.ts` next to the faker mock index when
 * `mock.fixtures` is on.
 *
 * @returns The path written, or `undefined` when nothing was written.
 */
export async function writeFixtures(
  builder: WriteSpecBuilder,
  output: NormalizedOutputOptions,
  header: string,
): Promise<string | undefined> {
  if (!output.mock.fixtures) return undefined;
  const faker = getFakerEntry(output.mock);
  if (!faker) return undefined;

  const fileInfo = getTargetFileInfo(builder, output);
  const mockDir = getMockDir(faker, output.mock) ?? fileInfo.dirname;
  const fakerIndex = path.join(mockDir, `index.faker${fileInfo.extension}`);
  if (!fs.existsSync(fakerIndex)) {
    logger.warn(
      `Fixtures: no faker mock index at ${fakerIndex}, so no fixtures were written. Fixtures need \`mock.indexMockFiles\` and mock files that aren't inlined.`,
    );
    return undefined;
  }

  const filePath = path.join(mockDir, `index.fixtures${fileInfo.extension}`);
  await writeGeneratedFile(
    filePath,
    buildFixtures(builder, output, {
      header,
      filePath,
      fakerImportPath: `./index.faker${getImportExtension(fileInfo.extension, output.tsconfig)}`,
      relativeSchemasPath: getSchemasImportPathFrom(filePath, output, fileInfo),
    }),
  );
  return filePath;
}
