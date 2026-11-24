/* oxlint-disable typescript/no-empty-object-type -- Preserve declaration merging for the legacy interfaces. */
// Keep the v8 import paths and interface augmentation points available to consumers.
// Canonical generator options are declared and exported by their owner packages.

import type * as Angular from '../../angular/src/options';
import type * as Axios from '../../axios/src/options';
import type * as Effect from '../../effect/src/options';
import type * as Fetch from '../../fetch/src/options';
import type * as Hono from '../../hono/src/options';
import type * as Mcp from '../../mcp/src/options';
import type * as Mock from '../../mock/src/options';
import type * as Query from '../../query/src/options';
import type * as Swr from '../../swr/src/options';
import type * as Valibot from '../../valibot/src/options';
import type * as Zod from '../../zod/src/options';

/** @deprecated Use AngularBaseUrlOptions from `@orval/angular`. */
export interface AngularBaseUrlOptions extends Angular.AngularBaseUrlOptions {}

/** @deprecated Use AngularRuntimeValidation from `@orval/angular`. */
export type AngularRuntimeValidation = Angular.AngularRuntimeValidation;

/** @deprecated Use NormalizedAngularRuntimeValidation from `@orval/angular`. */
export interface NormalizedAngularRuntimeValidation
  extends Angular.NormalizedAngularRuntimeValidation {}

/** @deprecated Use AngularOptions from `@orval/angular`. */
export interface AngularOptions extends Angular.AngularOptions {
  httpResource?: AngularHttpResourceOptions;
  baseUrl?: AngularBaseUrlOptions;
}

/** @deprecated Use NormalizedAngularOptions from `@orval/angular`. */
export interface NormalizedAngularOptions
  extends Angular.NormalizedAngularOptions {
  runtimeValidation: NormalizedAngularRuntimeValidation;
  httpResource?: AngularHttpResourceOptions;
  baseUrl?: AngularBaseUrlOptions;
}

/** @deprecated Use AngularHttpResourceOptions from `@orval/angular`. */
export interface AngularHttpResourceOptions
  extends Angular.AngularHttpResourceOptions {}

/** @deprecated Use NormalizedAxiosOptions from `@orval/axios`. */
export interface NormalizedAxiosOptions extends Axios.NormalizedAxiosOptions {}

/** @deprecated Use AxiosOptions from `@orval/axios`. */
export interface AxiosOptions extends Axios.AxiosOptions {}

/** @deprecated Use EffectVersionOption from `@orval/effect`. */
export type EffectVersionOption = Effect.EffectVersionOption;

/** @deprecated Use EffectOptions from `@orval/effect`. */
export interface EffectOptions extends Effect.EffectOptions {}

/** @deprecated Use OperationEffectOptions from `@orval/effect`. */
export type OperationEffectOptions = Omit<
  EffectOptions,
  'generateReusableSchemas'
>;

/** @deprecated Use NormalizedEffectOptions from `@orval/effect`. */
export interface NormalizedEffectOptions
  extends Effect.NormalizedEffectOptions {
  strict: NormalizedZodOptions['strict'];
  generate: NormalizedZodOptions['generate'];
}

/** @deprecated Use NormalizedFetchOptions from `@orval/fetch`. */
export interface NormalizedFetchOptions extends Fetch.NormalizedFetchOptions {}

/** @deprecated Use FetchRuntimeImplementationStyle from `@orval/fetch`. */
export type FetchRuntimeImplementationStyle =
  Fetch.FetchRuntimeImplementationStyle;

/** @deprecated Use FetchOptions from `@orval/fetch`. */
export interface FetchOptions extends Fetch.FetchOptions {}

/** @deprecated Use HonoHandlerStrategy from `@orval/hono`. */
export type HonoHandlerStrategy = Hono.HonoHandlerStrategy;

/** @deprecated Use NormalizedHonoOptions from `@orval/hono`. */
export interface NormalizedHonoOptions extends Hono.NormalizedHonoOptions {}

/** @deprecated Use HonoOptions from `@orval/hono`. */
export interface HonoOptions extends Hono.HonoOptions {}

/** @deprecated Use McpServerOptions from `@orval/mcp`. */
export interface McpServerOptions extends Mcp.McpServerOptions {}

/** @deprecated Use NormalizedMcpServerOptions from `@orval/mcp`. */
export interface NormalizedMcpServerOptions
  extends Mcp.NormalizedMcpServerOptions {}

/** @deprecated Use McpHandlerOptions from `@orval/mcp`. */
export interface McpHandlerOptions extends Mcp.McpHandlerOptions {}

/** @deprecated Use NormalizedMcpHandlerOptions from `@orval/mcp`. */
export interface NormalizedMcpHandlerOptions
  extends Mcp.NormalizedMcpHandlerOptions {}

/** @deprecated Use McpOptions from `@orval/mcp`. */
export interface McpOptions extends Mcp.McpOptions {
  server?: McpServerOptions;
  handler?: McpHandlerOptions;
}

/** @deprecated Use NormalizedMcpOptions from `@orval/mcp`. */
export interface NormalizedMcpOptions extends Mcp.NormalizedMcpOptions {
  server?: NormalizedMcpServerOptions;
  handler?: NormalizedMcpHandlerOptions;
}

/** @deprecated Use CommonMockOptions from `@orval/mock`. */
export interface CommonMockOptions extends Mock.CommonMockOptions {}

/** @deprecated Use MswMockOptions from `@orval/mock`. */
export interface MswMockOptions
  extends Mock.MswMockOptions, CommonMockOptions {}

/** @deprecated Use FakerMockOptions from `@orval/mock`. */
export interface FakerMockOptions
  extends Mock.FakerMockOptions, CommonMockOptions {}

/** @deprecated Use GlobalMockOptions from `@orval/mock`. */
export type GlobalMockOptions = MswMockOptions | FakerMockOptions;

/** @deprecated Use OverrideMockOptions from `@orval/mock`. */
export type OverrideMockOptions = Mock.OverrideMockOptions<GlobalMockOptions>;

/** @deprecated Use MockOptions from `@orval/mock`. */
export type MockOptions = Mock.MockOptions<GlobalMockOptions>;

/** @deprecated Use MockPropertiesObject from `@orval/mock`. */
export type MockPropertiesObject = Mock.MockPropertiesObject;

/** @deprecated Use MockPropertiesObjectFn from `@orval/mock`. */
export type MockPropertiesObjectFn = Mock.MockPropertiesObjectFn;

/** @deprecated Use MockProperties from `@orval/mock`. */
export type MockProperties = Mock.MockProperties;

/** @deprecated Use MockDataObject from `@orval/mock`. */
export type MockDataObject = Mock.MockDataObject;

/** @deprecated Use MockDataObjectFn from `@orval/mock`. */
export type MockDataObjectFn = Mock.MockDataObjectFn;

/** @deprecated Use MockDataArray from `@orval/mock`. */
export type MockDataArray = Mock.MockDataArray;

/** @deprecated Use MockDataArrayFn from `@orval/mock`. */
export type MockDataArrayFn = Mock.MockDataArrayFn;

/** @deprecated Use MockData from `@orval/mock`. */
export type MockData = Mock.MockData;

/** @deprecated Use InvalidateTargetParam from `@orval/query`. */
export type InvalidateTargetParam = Query.InvalidateTargetParam;

/** @deprecated Use InvalidateTarget from `@orval/query`. */
export type InvalidateTarget = Query.InvalidateTarget;

/** @deprecated Use MutationInvalidatesRule from `@orval/query`. */
export interface MutationInvalidatesRule
  extends Query.MutationInvalidatesRule {}

/** @deprecated Use MutationInvalidatesConfig from `@orval/query`. */
export type MutationInvalidatesConfig = MutationInvalidatesRule[];

/** @deprecated Use InfiniteQueryParamLocation from `@orval/query`. */
export type InfiniteQueryParamLocation = Query.InfiniteQueryParamLocation;

/** @deprecated Use QueryDocsOptions from `@orval/query`. */
export interface QueryDocsOptions extends Query.QueryDocsOptions {}

/** @deprecated Use NormalizedQueryOptions from `@orval/query`. */
export interface NormalizedQueryOptions extends Query.NormalizedQueryOptions {
  docs?: QueryDocsOptions;
  mutationInvalidates?: MutationInvalidatesConfig;
}

/** @deprecated Use QueryOptions from `@orval/query`. */
export interface QueryOptions extends Query.QueryOptions {
  docs?: QueryDocsOptions;
  mutationInvalidates?: MutationInvalidatesConfig;
}

/** @deprecated Use SwrOptions from `@orval/swr`. */
export interface SwrOptions extends Swr.SwrOptions {}

/** @deprecated Use ValibotOptions from `@orval/valibot`. */
export interface ValibotOptions extends Valibot.ValibotOptions {}

/** @deprecated Use OperationValibotOptions from `@orval/valibot`. */
export type OperationValibotOptions = Omit<
  ValibotOptions,
  'generateReusableSchemas' | 'unsupported'
>;

/** @deprecated Use NormalizedValibotOptions from `@orval/valibot`. */
export interface NormalizedValibotOptions
  extends Valibot.NormalizedValibotOptions {
  strict: NormalizedZodOptions['strict'];
  generate: NormalizedZodOptions['generate'];
}

/** @deprecated Use ZodDateTimeOptions from `@orval/zod`. */
export interface ZodDateTimeOptions extends Zod.ZodDateTimeOptions {}

/** @deprecated Use ZodTimeOptions from `@orval/zod`. */
export interface ZodTimeOptions extends Zod.ZodTimeOptions {}

/** @deprecated Use ZodVersionOption from `@orval/zod`. */
export type ZodVersionOption = Zod.ZodVersionOption;

/** @deprecated Use ZodVariantOption from `@orval/zod`. */
export type ZodVariantOption = Zod.ZodVariantOption;

/** @deprecated Use ZodOptions from `@orval/zod`. */
export type ZodOptions = Zod.ZodOptions<ZodDateTimeOptions, ZodTimeOptions>;

/** @deprecated Use OperationZodOptions from `@orval/zod`. */
export type OperationZodOptions = Zod.OperationZodOptions;

/** @deprecated Use OperationZodOverrideKey from `@orval/zod`. */
export type OperationZodOverrideKey = Zod.OperationZodOverrideKey;

/** @deprecated Use ZodCoerceType from `@orval/zod`. */
export type ZodCoerceType = Zod.ZodCoerceType;

/** @deprecated Use RefinementFunction from `@orval/zod`. */
export type RefinementFunction<TValue = never> = Zod.RefinementFunction<TValue>;

/** @deprecated Use Zod3RefinementParams from `@orval/zod`. */
export type Zod3RefinementParams = Zod.Zod3RefinementParams;

/** @deprecated Use Zod3RefinementOptions from `@orval/zod`. */
export type Zod3RefinementOptions<TValue> = Zod.Zod3RefinementOptions<TValue>;

/** @deprecated Use Zod4RefinementIssue from `@orval/zod`. */
export interface Zod4RefinementIssue extends Zod.Zod4RefinementIssue {}

/** @deprecated Use Zod4RefinementOptions from `@orval/zod`. */
export type Zod4RefinementOptions =
  Zod.Zod4RefinementOptions<Zod4RefinementIssue>;

/** @deprecated Use ZodRefinementOptions from `@orval/zod`. */
export type ZodRefinementOptions<
  TValue = never,
  TVersion extends ZodVersionOption = ZodVersionOption,
> = Zod.ZodRefinementOptions<TValue, TVersion, Zod4RefinementIssue>;

/** @deprecated Use RefinementBindings from `@orval/zod`. */
export type RefinementBindings = Zod.RefinementBindings;

/** @deprecated Use BoundRefinement from `@orval/zod`. */
export type BoundRefinement<
  TValue = never,
  TVersion extends ZodVersionOption = ZodVersionOption,
> = Zod.BoundRefinement<TValue, TVersion, Zod4RefinementIssue>;

/** @deprecated Use NormalizedZodOptions from `@orval/zod`. */
export interface NormalizedZodOptions extends Zod.NormalizedZodOptions {
  dateTimeOptions: ZodDateTimeOptions;
  timeOptions: ZodTimeOptions;
}

/** @deprecated Use NormalizedOperationZodOptions from `@orval/zod`. */
export type NormalizedOperationZodOptions = Zod.NormalizedOperationZodOptions;
