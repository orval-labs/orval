import type { allLocales } from '@faker-js/faker';
import type { OpenApiDocument, OutputMockType } from '@orval/core';

// Shared by every mock generator.
export interface CommonMockOptions {
  // Use OpenAPI examples to seed mock values where available
  useExamples?: boolean;
  // Generate response factories for every HTTP status defined in the spec
  generateEachHttpStatus?: boolean;
  // Faker locale (controls the `@faker-js/faker/locale/<x>` import path)
  locale?: keyof typeof allLocales;
  // Selects which response schema is mocked when multiple content types exist
  preferredContentType?: string;
  // Emit reusable mock factories for object-like array item schemas found in
  // operation responses (e.g. `getTenantResponseModelDtoMock` for
  // `value: TenantResponseModelDto[]`). Defaults to `false`.
  arrayItems?: boolean;
}

export interface MswMockOptions extends CommonMockOptions {
  type: typeof OutputMockType.MSW;
  // Emit faker responses in MSW handler output, defaults to true. Disable to
  // generate handlers only which require passing in mock responses, falls back
  // to `undefined` if no mock response passed to handler.
  operationResponses?: boolean;
  // Base URL prefix for the generated MSW route matchers
  baseUrl?: string;
  // Response delay before MSW handlers resolve (false disables delay)
  delay?: false | number | (() => number);
  // Execute the `delay` function at runtime rather than build time
  delayFunctionLazyExecute?: boolean;
  // Custom output directory for MSW mock files. Overrides the shared
  // `OutputMocksConfig.path` when set. Only picks where deinlined mock files
  // land; `OutputMocksConfig.inline: true` keeps mocks in the implementation
  // file in `single`/`tags` modes even when this path is set.
  path?: string;
}

export interface FakerMockOptions extends CommonMockOptions {
  type: typeof OutputMockType.FAKER;
  // Emit a consolidated mock factory file for every entry under
  // `components/schemas` (one `get<SchemaName>Mock` per schema). Defaults to
  // `false` — schema factories are opt-in to preserve existing output.
  schemas?: boolean;
  // Package specifier for importing the schema-level faker factories (the
  // `get<SchemaName>Mock` functions emitted when `schemas: true`). When set,
  // it is used verbatim as the schema factory import path instead of appending
  // `/index.faker` to `schemas.importPath`. This lets consumers expose fakers
  // through a dedicated barrel separate from the production type barrel.
  // Requires `schemas.importPath` or `schemasPath` to also be set.
  schemasImportPath?: string;
  // Output directory for the schema-level faker factories file
  // (`index.faker.ts`). Defaults to the `schemas` directory. Set it to keep
  // `@faker-js/faker` out of a schemas package, e.g. to a subdirectory of the
  // faker `path`. Requires `schemas: true` and `output.schemas`.
  schemasPath?: string;
  // Package specifier for the faker group barrel. When set, MSW files import
  // the `get<Op>ResponseMock` factories from it instead of a relative path
  // into the faker directory. Only used in `split` and `tags-split` modes,
  // where MSW and faker are written to separate files.
  importPath?: string;
  // Emit per-operation response mock factories (the historical behavior).
  // Defaults to `true`. Set to `false` together with `schemas: true` to get
  // only the consolidated schema factories.
  operationResponses?: boolean;
  // Custom output directory for faker mock files. Overrides the shared
  // `OutputMocksConfig.path` when set. Only picks where deinlined mock files
  // land; `OutputMocksConfig.inline: true` keeps mocks in the implementation
  // file in `single`/`tags` modes even when this path is set.
  path?: string;
}

export type GlobalMockOptions = MswMockOptions | FakerMockOptions;

export type OverrideMockOptions<
  TGlobal extends GlobalMockOptions = GlobalMockOptions,
> = Partial<TGlobal> & {
  arrayMin?: number;
  arrayMax?: number;
  stringMin?: number;
  stringMax?: number;
  numberMin?: number;
  numberMax?: number;
  required?: boolean; // When true, all properties are required (and thus not optional) in mocks.
  nonNullable?: boolean; // When true, nullable mock values are never wrapped in `arrayElement([value, null])`.
  exactOptional?: boolean; // When true, optional properties are omitted instead of set to `undefined`, for `exactOptionalPropertyTypes`.
  properties?: MockProperties;
  // Scope property overrides to a named schema (e.g. `components/schemas/Apple`),
  // so the same property name can mock differently per schema. Matching rules are
  // identical to `properties` (bare name, `/regex/`, exact `#.path`).
  schemas?: Record<string, { properties: MockProperties }>;
  format?: Record<string, unknown>;
  fractionDigits?: number;
};

export type MockOptions<TGlobal extends GlobalMockOptions = GlobalMockOptions> =
  Omit<OverrideMockOptions<TGlobal>, 'properties' | 'schemas'> & {
    properties?: Record<string, unknown>;
    operations?: Record<string, { properties: Record<string, unknown> }>;
    tags?: Record<string, { properties: Record<string, unknown> }>;
    schemas?: Record<string, { properties: Record<string, unknown> }>;
  };

export type MockPropertiesObject = Record<string, unknown>;

export type MockPropertiesObjectFn = (
  specs: OpenApiDocument,
) => MockPropertiesObject;

export type MockProperties = MockPropertiesObject | MockPropertiesObjectFn;

export type MockDataObject = Record<string, unknown>;

export type MockDataObjectFn = (specs: OpenApiDocument) => MockDataObject;

export type MockDataArray = unknown[];

export type MockDataArrayFn = (specs: OpenApiDocument) => MockDataArray;

export type MockData =
  | MockDataObject
  | MockDataObjectFn
  | MockDataArray
  | MockDataArrayFn;
