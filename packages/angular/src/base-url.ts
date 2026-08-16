import {
  type AngularBaseUrlOptions,
  type ClientExtraFilesBuilder,
  type ClientFileBuilder,
  type ContextSpec,
  getFileInfo,
  getImportExtension,
  jsDoc,
  type NormalizedOutputOptions,
  type OpenApiInfoObject,
  pascal,
  resolveServerUrl,
  snake,
  upath,
} from '@orval/core';

/**
 * Reads the file-level JSDoc header configured via `output.override.header`.
 *
 * Mirrors the identically-named helper in `http-resource.ts` — duplicated
 * (rather than imported) to keep this module free of a dependency on the
 * httpResource generator.
 */
const getHeader = (
  option: false | ((info: OpenApiInfoObject) => string | string[]),
  info: OpenApiInfoObject | undefined,
): string => {
  if (!option || !info) {
    return '';
  }

  const header = option(info);

  return Array.isArray(header) ? jsDoc({ description: header }) : header;
};

/** `example-api` -> `EXAMPLE_API` — the shared constant-case prefix for every generated identifier. */
export const getBaseUrlConstantPrefix = (apiId: string): string =>
  snake(apiId).toUpperCase();

/** `example-api` -> `EXAMPLE_API_SERVER_URL` */
export const getBaseUrlServerUrlConstantName = (apiId: string): string =>
  `${getBaseUrlConstantPrefix(apiId)}_SERVER_URL`;

/** `example-api` -> `EXAMPLE_API_BASE_URL` */
export const getBaseUrlTokenName = (apiId: string): string =>
  `${getBaseUrlConstantPrefix(apiId)}_BASE_URL`;

/** `example-api` -> `EXAMPLE_API_BASE_URL_RESOLVER` */
export const getBaseUrlResolverTokenName = (apiId: string): string =>
  `${getBaseUrlConstantPrefix(apiId)}_BASE_URL_RESOLVER`;

/** `example-api` -> `ExampleApiBaseUrlResolver` (resolver function type name) */
export const getBaseUrlResolverTypeName = (apiId: string): string =>
  `${pascal(apiId)}BaseUrlResolver`;

/** `example-api` -> `ExampleApiBaseUrlResolverContext` (resolver context type name) */
export const getBaseUrlResolverContextTypeName = (apiId: string): string =>
  `${pascal(apiId)}BaseUrlResolverContext`;

/** `example-api` -> `provideExampleApiBaseUrl` */
export const getProvideBaseUrlName = (apiId: string): string =>
  `provide${pascal(apiId)}BaseUrl`;

/** `example-api` -> `provideExampleApiBaseUrlResolver` */
export const getProvideBaseUrlResolverName = (apiId: string): string =>
  `provide${pascal(apiId)}BaseUrlResolver`;

/**
 * Builds the full generated source for a `<target>.base-url.ts` file.
 *
 * The emitted module exposes, purely through Angular DI, the precedence chain
 * documented in `override.angular.baseUrl`'s guide:
 *
 * 1. A directly provided `<API_ID>_BASE_URL` token value (`provideXBaseUrl`) —
 *    wins outright; the resolver below is never invoked.
 * 2. A directly provided `<API_ID>_BASE_URL_RESOLVER` (`provideXBaseUrlResolver`).
 * 3. The default resolver factory, which returns the embedded spec server URL.
 * 4. The embedded `<API_ID>_SERVER_URL` constant (`''` when the specification
 *    has no `servers` entry), passed to whichever resolver above ends up running.
 *
 * All exported members carry explicit return types and no `any`, matching the
 * rest of the generated Angular output.
 */
export const buildAngularBaseUrlFileContent = ({
  apiId,
  serverUrl,
}: {
  apiId: string;
  serverUrl: string;
}): string => {
  const serverUrlConstantName = getBaseUrlServerUrlConstantName(apiId);
  const tokenName = getBaseUrlTokenName(apiId);
  const resolverTokenName = getBaseUrlResolverTokenName(apiId);
  const resolverTypeName = getBaseUrlResolverTypeName(apiId);
  const contextTypeName = getBaseUrlResolverContextTypeName(apiId);
  const provideBaseUrlName = getProvideBaseUrlName(apiId);
  const provideBaseUrlResolverName = getProvideBaseUrlResolverName(apiId);

  return `import { InjectionToken, inject, type Provider } from '@angular/core';

/**
 * Embedded fallback base URL for the \`${apiId}\` API, resolved at generation
 * time from the OpenAPI specification's \`servers\` field (\`''\` when the
 * specification has no servers).
 */
export const ${serverUrlConstantName}: string = ${JSON.stringify(serverUrl)};

/**
 * Strips trailing slashes from a base URL.
 *
 * Generated routes always start with \`/\`, so normalizing here at the token
 * boundary guarantees \`\${baseUrl}\${route}\` can never double or drop the
 * separator between them, for either \`HttpClient\` services or \`httpResource\`
 * functions.
 */
export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\\/+$/, '');
}

/** Context passed to a \`${resolverTypeName}\` when it is invoked. */
export interface ${contextTypeName} {
  /** The explicit \`apiId\` configured via \`override.angular.baseUrl\`. */
  readonly apiId: ${JSON.stringify(apiId)};
  /** The embedded fallback server URL (\`${serverUrlConstantName}\`). */
  readonly serverUrl: string;
}

/** Resolves the runtime base URL for the \`${apiId}\` API. */
export type ${resolverTypeName} = (context: ${contextTypeName}) => string;

/**
 * Injectable hook for resolving the \`${apiId}\` API's base URL at runtime
 * (e.g. from a gateway route registry). Overridden via
 * \`${provideBaseUrlResolverName}\`; defaults to the embedded specification
 * server URL.
 */
export const ${resolverTokenName} = new InjectionToken<${resolverTypeName}>(
  ${JSON.stringify(resolverTokenName)},
  {
    providedIn: 'root',
    factory: (): ${resolverTypeName} => (context) => context.serverUrl,
  },
);

/**
 * Runtime base URL for the \`${apiId}\` API, composed via Angular DI.
 *
 * Precedence: a directly provided value (\`${provideBaseUrlName}\`) wins
 * outright; otherwise the \`${resolverTokenName}\` resolver (default or
 * provided via \`${provideBaseUrlResolverName}\`) is invoked with the embedded
 * \`${serverUrlConstantName}\` fallback. The result is always normalized.
 */
export const ${tokenName} = new InjectionToken<string>(${JSON.stringify(tokenName)}, {
  providedIn: 'root',
  factory: (): string => {
    const resolver = inject(${resolverTokenName});
    return normalizeBaseUrl(
      resolver({ apiId: ${JSON.stringify(apiId)}, serverUrl: ${serverUrlConstantName} }),
    );
  },
});

/** Directly provides the \`${apiId}\` API's base URL, bypassing the resolver. */
export function ${provideBaseUrlName}(baseUrl: string): Provider {
  return { provide: ${tokenName}, useValue: normalizeBaseUrl(baseUrl) };
}

/** Provides a custom resolver for the \`${apiId}\` API's base URL. */
export function ${provideBaseUrlResolverName}(
  resolver: ${resolverTypeName},
): Provider {
  return { provide: ${resolverTokenName}, useValue: resolver };
}
`;
};

/**
 * Path of the generated `<target>.base-url.ts` file for the current output.
 *
 * Unlike the `httpResource` extra-file mechanism (one sibling file per tag in
 * `tags` / `tags-split` mode), there is exactly one base-URL file per output —
 * the DI tokens it exports are shared by every generated file regardless of mode.
 */
export const getAngularBaseUrlFilePath = (
  output: NormalizedOutputOptions,
): string => {
  const { dirname, filename, extension } = getFileInfo(output.target, {
    extension: output.fileExtension,
  });

  return upath.joinSafe(dirname, `${filename}.base-url${extension}`);
};

/**
 * Import specifier a generated implementation file uses to reach the
 * base-URL file produced by {@link getAngularBaseUrlFilePath}.
 *
 * Always authored as if the importing file sat next to the base-URL file
 * (i.e. directly in `<dirname>`) — this matches `single`/`split`/`tags` mode,
 * where implementation files are in fact siblings. `tags-split` mode nests
 * implementation files one directory below (`<dirname>/<tag>/<tag>.ts`), but
 * the `tags-split` writer (`writers/split-tags-mode.ts`) already generically
 * re-resolves every relative `GeneratorImport.importPath` — originally
 * authored relative to `dirname` — against the operation's actual nested
 * file location. Special-casing `'../'` here as well would double-apply that
 * shift and produce a broken `../../` import.
 */
export const getAngularBaseUrlImportSpecifier = (
  output: NormalizedOutputOptions,
): string => {
  const { filename, extension } = getFileInfo(output.target, {
    extension: output.fileExtension,
  });
  const importExtension = getImportExtension(extension, output.tsconfig);

  return `./${filename}.base-url${importExtension}`;
};

const buildBaseUrlExtraFile = (
  baseUrl: AngularBaseUrlOptions,
  output: NormalizedOutputOptions,
  context: ContextSpec,
  header: string,
): ClientFileBuilder => {
  const serverUrl = resolveServerUrl(context.spec.servers, {
    index: baseUrl.index,
    variables: baseUrl.variables,
  });

  return {
    path: getAngularBaseUrlFilePath(output),
    content: `${header}${buildAngularBaseUrlFileContent({ apiId: baseUrl.apiId, serverUrl })}`,
  };
};

/**
 * Emits the opt-in `<target>.base-url.ts` extra file when
 * `override.angular.baseUrl` is configured; a zero-cost no-op (`[]`) otherwise.
 *
 * @returns Zero or one `ClientFileBuilder` describing the generated base-URL file.
 */
export const generateAngularBaseUrlExtraFiles: ClientExtraFilesBuilder = (
  _verbOptions,
  output,
  context,
) => {
  const baseUrl = output.override.angular.baseUrl;
  if (!baseUrl) {
    return Promise.resolve([]);
  }

  const header = getHeader(output.override.header, context.spec.info);

  return Promise.resolve([
    buildBaseUrlExtraFile(baseUrl, output, context, header),
  ]);
};
