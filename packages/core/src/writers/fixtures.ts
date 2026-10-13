import fs from 'node:fs';
import path from 'node:path';

import { generateDependencyImports } from '../generators';
import { camelPathParamName, toColonRoutePath } from '../getters';
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
  /** The `get<Op>ResponseMock` factory, when the faker generator emits one. */
  mock: string | null;
  status: number;
  /** Faker seed for the route's mock, fixed at generation time. */
  seed: number;
  /** Path params by generated key, in path order. */
  params: string[];
  body: string;
  response: string;
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
    const keys = new Map(entry.pathParams.map((p) => [p.name, p.key]));
    // Match on the path only, so an absolute base URL keeps just its path.
    const url = (entry.url ?? entry.path).replace(
      /^[a-z][\d+.a-z-]*:\/\/[^/]+/i,
      '',
    );
    const route = `${entry.method} ${toColonRoutePath(
      url,
      (name) => keys.get(name) ?? camelPathParamName(name),
    )}`;
    if (routes.has(route)) {
      logger.warn(
        `Fixtures: "${route}" is served by more than one operation, keeping the first one.`,
      );
      continue;
    }
    const types = getOperationManifestTypes(verbOptions);
    routes.set(route, {
      route,
      mock: entry.mock,
      status: successStatus(verbOptions.response.types.success[0]?.key),
      seed: seedFor(route),
      params: entry.pathParams.map((p) => p.key),
      body: types.body,
      response: types.response,
      imports: types.imports,
    });
  }
  return [...routes.values()].toSorted((a, b) =>
    a.route.localeCompare(b.route),
  );
}

const renderRoutes = (routes: FixtureRouteEntry[]) => {
  const lines = routes.map(
    ({ route, mock, status, seed }) =>
      `  ${JSON.stringify(route)}: { mock: ${mock ?? 'null'}, status: ${status}, seed: ${seed} },`,
  );
  return `const routes: Record<string, { mock: (() => unknown) | null; status: number; seed: number }> = {
${lines.join('\n')}
};
`;
};

const renderTypes = (routes: FixtureRouteEntry[]) => {
  const lines = routes.map(
    ({ route, mock, params, body, response }) =>
      `  ${JSON.stringify(route)}: {\n` +
      `    params: ${params.length > 0 ? `{ ${params.map((key) => `${JSON.stringify(key)}: string`).join('; ')} }` : 'Record<string, never>'};\n` +
      `    body: ${body};\n` +
      `    response: ${response};\n` +
      `    mocked: ${mock ? 'true' : 'false'};\n` +
      `  };`,
  );
  return `/** The params, body and response of every route. \`mocked\` routes default to their mock. */
export type FixtureRoutes = {
${lines.join('\n')}
};
`;
};

// The runtime half of the fixtures file. It only depends on the generated
// `routes` and `FixtureRoutes` above it.
const HELPERS = `
type FixtureMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/** A route in the spec, e.g. \`"GET /pets/:petId"\`. */
export type FixtureRoute = keyof FixtureRoutes;

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
export interface FixtureResponse {
  readonly [RESPONSE]: true;
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

/** Answers with this status, body and headers instead of the route's mock. */
export const respond = (
  status: number,
  body?: unknown,
  headers?: Record<string, string>,
): FixtureResponse => ({ [RESPONSE]: true, status, body, ...(headers ? { headers } : {}) });

type FixtureBody<R extends FixtureRoute> = FixtureRoutes[R]['mocked'] extends true
  ? DeepPartial<FixtureRoutes[R]['response']>
  : FixtureRoutes[R]['response'];

/**
 * A route's fixture: its response body (deep-merged onto the route's mock when it
 * has one, \`undefined\` for the mock as is), a {@link respond} result, or a
 * function of the request returning either.
 */
export type FixtureValue<R extends FixtureRoute> =
  | FixtureBody<R>
  | FixtureResponse
  | ((
      request: FixtureRequest<FixtureRoutes[R]['params'], FixtureRoutes[R]['body']>,
    ) => FixtureBody<R> | FixtureResponse);

/** Fixtures by route. A \`?name=value\` suffix only matches requests with that query. */
export type Fixtures = { [R in FixtureRoute]?: FixtureValue<R> } & {
  [R in FixtureRoute as \`\${R}?\${string}\`]?: FixtureValue<R>;
};

/** Fixtures for routes the spec doesn't describe. Nothing about them is checked. */
export type UntypedFixtures = Record<\`\${FixtureMethod} /\${string}\`, unknown>;

export interface FixtureOptions {
  untyped?: UntypedFixtures;
  /** Added to every route's seed: different mock values, still the same on every run. */
  seed?: number;
}

export interface FixtureSet {
  readonly fixtures: Readonly<Record<string, unknown>>;
  readonly seed: number;
  /** A new set with \`fixtures\` on top. Bodies of the same route deep-merge, anything else replaces. */
  extend(fixtures: Fixtures, options?: FixtureOptions): FixtureSet;
}

export interface FixtureResult {
  /** The fixture key that answered. */
  route: string;
  status: number;
  body: unknown;
  headers?: Record<string, string>;
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

const createSet = (fixtures: Record<string, unknown>, seed: number): FixtureSet => ({
  fixtures,
  seed,
  extend: (next, options = {}) => {
    const merged = { ...fixtures };
    for (const [key, value] of Object.entries({ ...next, ...options.untyped })) {
      merged[key] = merge(merged[key], value);
    }
    return createSet(merged, options.seed ?? seed);
  },
});

/** Fixtures by route, checked against the spec. */
export const defineFixtures = (fixtures: Fixtures, options?: FixtureOptions): FixtureSet =>
  createSet({}, 0).extend(fixtures, options);

interface CompiledFixture {
  key: string;
  route: string;
  method: string;
  /** \`null\` for a param segment. */
  segments: (string | null)[];
  params: string[];
  query: [string, string][];
}

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

const compiledSets = new WeakMap<FixtureSet, CompiledFixture[]>();

const compile = (set: FixtureSet): CompiledFixture[] => {
  const cached = compiledSets.get(set);
  if (cached) return cached;
  const compiled = Object.keys(set.fixtures)
    .map((key) => {
      const queryStart = key.indexOf('?');
      const route = queryStart === -1 ? key : key.slice(0, queryStart);
      const space = route.indexOf(' ');
      const parts = route.slice(space + 1).split('/').filter(Boolean);
      const segments = parts.map((part) => (part.startsWith(':') ? null : part));
      const query = [...new URLSearchParams(queryStart === -1 ? '' : key.slice(queryStart + 1))];
      return {
        key,
        route,
        method: route.slice(0, space).toUpperCase(),
        segments,
        params: parts.filter((part) => part.startsWith(':')).map((part) => part.slice(1)),
        query,
      };
    })
    .sort(bySpecificity);
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
  const url = new URL(request.url, 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean).map(decodeSegment);
  const method = request.method.toUpperCase();
  for (const candidate of compile(set)) {
    if (
      candidate.method !== method ||
      candidate.segments.length !== parts.length ||
      !candidate.segments.every((segment, index) => segment === null || segment === parts[index]) ||
      !candidate.query.every(([name, value]) => url.searchParams.get(name) === value)
    ) {
      continue;
    }
    const values = parts.filter((_, index) => candidate.segments[index] === null);
    const params = Object.fromEntries(
      candidate.params.map((name, index) => [name, values[index] ?? '']),
    );
    const fixture = set.fixtures[candidate.key];
    const value =
      typeof fixture === 'function'
        ? (fixture as (request: FixtureRequest) => unknown)({ method, url, params, body: request.body })
        : fixture;
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
    faker.seed(defaults.seed + set.seed);
    return { route: candidate.key, status: defaults.status, body: merge(defaults.mock(), value) };
  }
  return undefined;
};
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
