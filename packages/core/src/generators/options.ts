import { getSuccessResponseType } from '../getters/res-req-types';
import {
  type GeneratorMutator,
  type GeneratorSchema,
  type GetterBody,
  type GetterQueryParam,
  type GetterResponse,
  type ParamsSerializerOptions,
  Verbs,
} from '../types';
import { getIsBodyVerb, isObject, stringify } from '../utils';

/**
 * Per-parameter Angular query-object serialization strategy, mirroring
 * {@link GetterQueryParam.objectQueryParams}. See issue #3705.
 */
export type AngularObjectParamStrategy = 'flatten' | 'comma' | 'deepObject';

/**
 * Filters query params for Angular's HttpClient.
 *
 * Why: Angular's HttpParams / HttpClient `params` type does not accept `null` or
 * `undefined` values, and arrays must only contain string/number/boolean.
 * Orval models often include nullable query params, so we remove nullish values
 * (including nulls inside arrays) before passing params to HttpClient or a
 * paramsSerializer to avoid runtime and type issues.
 *
 * Returns an inline IIFE expression. For paths that benefit from a shared helper
 * (e.g. observe-mode branches), prefer getAngularFilteredParamsCallExpression +
 * getAngularFilteredParamsHelperBody instead.
 */
export const getAngularFilteredParamsExpression = (
  paramsExpression: string,
  requiredNullableParamKeys: string[] = [],
  preserveRequiredNullables = false,
  nonPrimitiveKeys: string[] = [],
  objectParamStrategies: Readonly<
    Record<string, AngularObjectParamStrategy>
  > = {},
): string => {
  const hasPassthrough = nonPrimitiveKeys.length > 0;
  const hasObjectStrategies = Object.keys(objectParamStrategies).length > 0;
  const filteredParamValueType = hasPassthrough
    ? 'unknown'
    : `string | number | boolean${preserveRequiredNullables ? ' | null' : ''} | Array<string | number | boolean>`;
  const passthroughBranch = hasPassthrough
    ? `    if (passthroughKeys.has(key)) {
      if (value !== undefined) {
        filteredParams[key] = value;
      }
      continue;
    }
`
    : '';

  const objectStrategyBranch = hasObjectStrategies
    ? `    if (
      value != null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.hasOwn(objectParamStrategies, key)
    ) {
      const objectStrategy = objectParamStrategies[key];
      const entries = Object.entries(value as Record<string, unknown>);
      if (objectStrategy === 'comma') {
        const commaParts: string[] = [];
        for (const [prop, propValue] of entries) {
          if (Array.isArray(propValue)) {
            const filteredItems = propValue.filter(
              (item) =>
                item != null &&
                (typeof item === 'string' ||
                  typeof item === 'number' ||
                  typeof item === 'boolean'),
            ) as Array<string | number | boolean>;
            if (filteredItems.length) {
              commaParts.push(prop, ...filteredItems.map(String));
            }
          } else if (
            propValue != null &&
            (typeof propValue === 'string' ||
              typeof propValue === 'number' ||
              typeof propValue === 'boolean')
          ) {
            commaParts.push(prop, String(propValue));
          }
        }
        if (commaParts.length) {
          filteredParams[key] = commaParts.join(',');
        }
      } else {
        for (const [prop, propValue] of entries) {
          const targetKey =
            objectStrategy === 'deepObject' ? key + '[' + prop + ']' : prop;
          if (Array.isArray(propValue)) {
            const filteredProp = propValue.filter(
              (item) =>
                item != null &&
                (typeof item === 'string' ||
                  typeof item === 'number' ||
                  typeof item === 'boolean'),
            ) as Array<string | number | boolean>;
            if (filteredProp.length) {
              filteredParams[targetKey] = filteredProp;
            }
          } else if (
            propValue != null &&
            (typeof propValue === 'string' ||
              typeof propValue === 'number' ||
              typeof propValue === 'boolean')
          ) {
            filteredParams[targetKey] = propValue;
          }
        }
      }
      continue;
    }
`
    : '';

  // Generate requiredNullableParamKeys only if preserveRequiredNullables are 'true'
  // Otherwise, typescript throw an error (TS6133: 'requiredNullableParamKeys' is declared but its value is never read.)
  let preserveNullableBranch: string;
  let requiredNullableParamKeysBranch: string;
  if (preserveRequiredNullables) {
    preserveNullableBranch = `    } else if (value === null && requiredNullableParamKeys.has(key)) {
      filteredParams[key] = null;
`;
    requiredNullableParamKeysBranch = `const requiredNullableParamKeys = new Set<string>(${JSON.stringify(requiredNullableParamKeys)});`;
  } else {
    preserveNullableBranch = '';
    requiredNullableParamKeysBranch = '';
  }

  const scalarBranch = `    } else if (
      value != null &&
      (typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean')
    ) {
      filteredParams[key] = value;
    }
`;
  const passthroughDecl = hasPassthrough
    ? `  const passthroughKeys = new Set<string>(${JSON.stringify(nonPrimitiveKeys)});\n`
    : '';
  const objectStrategiesDecl = hasObjectStrategies
    ? `  const objectParamStrategies: Readonly<Record<string, 'flatten' | 'comma' | 'deepObject'>> = ${JSON.stringify(objectParamStrategies)};\n`
    : '';

  return `(() => {
${passthroughDecl}${objectStrategiesDecl}  ${requiredNullableParamKeysBranch}
  const filteredParams: Record<string, ${filteredParamValueType}> = {};
  for (const [key, value] of Object.entries(${paramsExpression})) {
${passthroughBranch}${objectStrategyBranch}    if (Array.isArray(value)) {
      const filtered = value.filter(
        (item) =>
          item != null &&
          (typeof item === 'string' ||
            typeof item === 'number' ||
            typeof item === 'boolean'),
      ) as Array<string | number | boolean>;
      if (filtered.length) {
        filteredParams[key] = filtered;
      }
${preserveNullableBranch}${scalarBranch}  }
  return filteredParams;
})()`;
};

/**
 * Returns the body of a standalone `filterParams` helper function
 * to be emitted once in the generated file header, replacing the
 * inline IIFE that was previously duplicated in every method.
 *
 * Pass `{ hasObjectParams: true }` only when at least one operation in the
 * file actually needs the object-serialization overload (issue #3705) —
 * with the flag omitted/false this returns the exact same string as before
 * that feature existed, so files without object query params see zero
 * helper churn.
 */
export const getAngularFilteredParamsHelperBody = ({
  hasObjectParams = false,
}: { hasObjectParams?: boolean } = {}): string => {
  if (!hasObjectParams) {
    return `type AngularHttpParamValue = string | number | boolean | Array<string | number | boolean>;
type AngularHttpParamValueWithNullable = AngularHttpParamValue | null;

function filterParams(
  params: Record<string, unknown>,
  requiredNullableKeys?: ReadonlySet<string>,
  preserveRequiredNullables?: false,
  passthroughKeys?: undefined,
): Record<string, AngularHttpParamValue>;
function filterParams(
  params: Record<string, unknown>,
  requiredNullableKeys: ReadonlySet<string> | undefined,
  preserveRequiredNullables: true,
  passthroughKeys?: undefined,
): Record<string, AngularHttpParamValueWithNullable>;
function filterParams(
  params: Record<string, unknown>,
  requiredNullableKeys: ReadonlySet<string> | undefined,
  preserveRequiredNullables: boolean | undefined,
  passthroughKeys: ReadonlySet<string>,
): Record<string, unknown>;
function filterParams(
  params: Record<string, unknown>,
  requiredNullableKeys: ReadonlySet<string> = new Set(),
  preserveRequiredNullables = false,
  passthroughKeys: ReadonlySet<string> = new Set(),
): Record<string, unknown> {
  const filteredParams: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (passthroughKeys.has(key)) {
      if (value !== undefined) {
        filteredParams[key] = value;
      }
      continue;
    }
    if (Array.isArray(value)) {
      const filtered = value.filter(
        (item) =>
          item != null &&
          (typeof item === 'string' ||
            typeof item === 'number' ||
            typeof item === 'boolean'),
      ) as Array<string | number | boolean>;
      if (filtered.length) {
        filteredParams[key] = filtered;
      }
    } else if (
      preserveRequiredNullables &&
      value === null &&
      requiredNullableKeys.has(key)
    ) {
      filteredParams[key] = null;
    } else if (
      value != null &&
      (typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean')
    ) {
      filteredParams[key] = value;
    }
  }
  return filteredParams;
}`;
  }

  return `type AngularHttpParamValue = string | number | boolean | Array<string | number | boolean>;
type AngularHttpParamValueWithNullable = AngularHttpParamValue | null;
type AngularObjectParamStrategy = 'flatten' | 'comma' | 'deepObject';

function filterParams(
  params: Record<string, unknown>,
  requiredNullableKeys?: ReadonlySet<string>,
  preserveRequiredNullables?: false,
  passthroughKeys?: undefined,
): Record<string, AngularHttpParamValue>;
function filterParams(
  params: Record<string, unknown>,
  requiredNullableKeys: ReadonlySet<string> | undefined,
  preserveRequiredNullables: true,
  passthroughKeys?: undefined,
): Record<string, AngularHttpParamValueWithNullable>;
function filterParams(
  params: Record<string, unknown>,
  requiredNullableKeys: ReadonlySet<string> | undefined,
  preserveRequiredNullables: boolean | undefined,
  passthroughKeys: ReadonlySet<string>,
): Record<string, unknown>;
function filterParams(
  params: Record<string, unknown>,
  requiredNullableKeys: ReadonlySet<string> | undefined,
  preserveRequiredNullables: boolean | undefined,
  passthroughKeys: ReadonlySet<string> | undefined,
  objectParamStrategies: Readonly<Record<string, AngularObjectParamStrategy>>,
): Record<string, AngularHttpParamValue>;
function filterParams(
  params: Record<string, unknown>,
  requiredNullableKeys: ReadonlySet<string> = new Set(),
  preserveRequiredNullables = false,
  passthroughKeys: ReadonlySet<string> = new Set(),
  objectParamStrategies: Readonly<Record<string, AngularObjectParamStrategy>> = {},
): Record<string, unknown> {
  const filteredParams: Record<string, unknown> = {};
  const filterPrimitiveArray = (
    value: unknown[],
  ): Array<string | number | boolean> =>
    value.filter(
      (item) =>
        item != null &&
        (typeof item === 'string' ||
          typeof item === 'number' ||
          typeof item === 'boolean'),
    ) as Array<string | number | boolean>;
  for (const [key, value] of Object.entries(params)) {
    if (passthroughKeys.has(key)) {
      if (value !== undefined) {
        filteredParams[key] = value;
      }
      continue;
    }
    if (
      value != null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.hasOwn(objectParamStrategies, key)
    ) {
      const objectStrategy = objectParamStrategies[key];
      const entries = Object.entries(value as Record<string, unknown>);
      if (objectStrategy === 'comma') {
        const commaParts: string[] = [];
        for (const [prop, propValue] of entries) {
          if (Array.isArray(propValue)) {
            const filteredItems = filterPrimitiveArray(propValue);
            if (filteredItems.length) {
              commaParts.push(prop, ...filteredItems.map(String));
            }
          } else if (
            propValue != null &&
            (typeof propValue === 'string' ||
              typeof propValue === 'number' ||
              typeof propValue === 'boolean')
          ) {
            commaParts.push(prop, String(propValue));
          }
        }
        if (commaParts.length) {
          filteredParams[key] = commaParts.join(',');
        }
      } else {
        for (const [prop, propValue] of entries) {
          const targetKey =
            objectStrategy === 'deepObject' ? key + '[' + prop + ']' : prop;
          if (Array.isArray(propValue)) {
            const filteredProp = filterPrimitiveArray(propValue);
            if (filteredProp.length) {
              filteredParams[targetKey] = filteredProp;
            }
          } else if (
            propValue != null &&
            (typeof propValue === 'string' ||
              typeof propValue === 'number' ||
              typeof propValue === 'boolean')
          ) {
            filteredParams[targetKey] = propValue;
          }
        }
      }
      continue;
    }
    if (Array.isArray(value)) {
      const filtered = filterPrimitiveArray(value);
      if (filtered.length) {
        filteredParams[key] = filtered;
      }
    } else if (
      preserveRequiredNullables &&
      value === null &&
      requiredNullableKeys.has(key)
    ) {
      filteredParams[key] = null;
    } else if (
      value != null &&
      (typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean')
    ) {
      filteredParams[key] = value;
    }
  }
  return filteredParams;
}`;
};

/**
 * Returns a call expression to the `filterParams` helper function.
 */
export const getAngularFilteredParamsCallExpression = (
  paramsExpression: string,
  requiredNullableParamKeys: string[] = [],
  preserveRequiredNullables = false,
  nonPrimitiveKeys: string[] = [],
  objectParamStrategies: Readonly<
    Record<string, AngularObjectParamStrategy>
  > = {},
): string => {
  const baseArgs = `${paramsExpression}, new Set<string>(${JSON.stringify(requiredNullableParamKeys)})`;
  const hasObjectStrategies = Object.keys(objectParamStrategies).length > 0;
  if (hasObjectStrategies) {
    return `filterParams(${baseArgs}, ${preserveRequiredNullables}, new Set<string>(${JSON.stringify(nonPrimitiveKeys)}), ${JSON.stringify(objectParamStrategies)} as const)`;
  }
  if (nonPrimitiveKeys.length > 0) {
    return `filterParams(${baseArgs}, ${preserveRequiredNullables}, new Set<string>(${JSON.stringify(nonPrimitiveKeys)}))`;
  }
  return `filterParams(${baseArgs}${preserveRequiredNullables ? ', true' : ''})`;
};

/**
 * Returns the filter call/IIFE used to massage query params before passing
 * them to Angular's HttpParams. When the user supplied a `paramsFilter`
 * mutator, the built-in `filterParams` is bypassed entirely and the user's
 * function is called with the raw params — they own nullish-stripping and
 * any object/array handling. Otherwise the built-in filter is used (either
 * the shared helper or an inline IIFE), and callers should only pass
 * `nonPrimitiveKeys` when a downstream serializer or custom consumer can
 * legally handle raw object/array values.
 */
export const buildAngularParamsFilterExpression = ({
  paramsExpression,
  requiredNullableParamKeys = [],
  preserveRequiredNullables = false,
  nonPrimitiveKeys = [],
  objectParamStrategies = {},
  paramsFilter,
  useSharedHelper,
}: {
  paramsExpression: string;
  requiredNullableParamKeys?: string[];
  preserveRequiredNullables?: boolean;
  nonPrimitiveKeys?: string[];
  objectParamStrategies?: Readonly<Record<string, AngularObjectParamStrategy>>;
  paramsFilter?: GeneratorMutator;
  useSharedHelper: boolean;
}): string => {
  if (paramsFilter) {
    return `${paramsFilter.name}(${paramsExpression})`;
  }
  if (useSharedHelper) {
    return getAngularFilteredParamsCallExpression(
      paramsExpression,
      requiredNullableParamKeys,
      preserveRequiredNullables,
      nonPrimitiveKeys,
      objectParamStrategies,
    );
  }
  return getAngularFilteredParamsExpression(
    paramsExpression,
    requiredNullableParamKeys,
    preserveRequiredNullables,
    nonPrimitiveKeys,
    objectParamStrategies,
  );
};

/**
 * Computes the gated object-serialization strategy map for a single
 * operation's query params (issue #3705).
 *
 * Strategies are suppressed — returning `{}`, restoring the pre-#3705
 * dropping behavior — whenever:
 * - a `paramsFilter` mutator is configured (it bypasses the built-in filter
 *   entirely and owns raw object/array handling itself), or
 * - a `paramsSerializer` mutator is configured (it receives the raw object
 *   via the existing `nonPrimitiveKeys` passthrough instead), or
 * - `override.angular.queryObjectSerialization` is `'legacy'`.
 */
export const getAngularObjectParamStrategies = ({
  queryParams,
  paramsSerializer,
  paramsFilter,
  queryObjectSerialization,
}: {
  queryParams?: GetterQueryParam;
  paramsSerializer?: GeneratorMutator;
  paramsFilter?: GeneratorMutator;
  queryObjectSerialization: 'spec' | 'legacy';
}): Readonly<Record<string, AngularObjectParamStrategy>> => {
  if (
    paramsFilter ||
    paramsSerializer ||
    queryObjectSerialization === 'legacy' ||
    !queryParams?.objectQueryParams?.length
  ) {
    return {};
  }
  return Object.fromEntries(
    queryParams.objectQueryParams.map(({ key, strategy }) => [key, strategy]),
  );
};

interface GenerateFormDataAndUrlEncodedFunctionOptions {
  body: GetterBody;
  formData?: GeneratorMutator;
  formUrlEncoded?: GeneratorMutator;
  isFormData: boolean;
  isFormUrlEncoded: boolean;
}

export function generateBodyOptions(
  body: GetterBody,
  isFormData: boolean,
  isFormUrlEncoded: boolean,
): string | undefined {
  if (isFormData && body.formData) {
    return 'formData';
  }

  if (isFormUrlEncoded && body.formUrlEncoded) {
    return 'formUrlEncoded';
  }

  if (body.implementation) {
    return body.implementation;
  }

  return undefined;
}

interface GenerateAxiosOptions {
  response: GetterResponse;
  isExactOptionalPropertyTypes: boolean;
  angularObserve?: 'body' | 'events' | 'response';
  angularParamsRef?: string;
  requiredNullableQueryParamKeys?: string[];
  nonPrimitiveQueryParamKeys?: string[];
  objectQueryParamStrategies?: Readonly<
    Record<string, AngularObjectParamStrategy>
  >;
  queryParams?: GeneratorSchema;
  headers?: GeneratorSchema;
  requestOptions?: object | boolean;
  hasSignal: boolean;
  hasSignalParam?: boolean;
  isAngular: boolean;
  paramsSerializer?: GeneratorMutator;
  paramsSerializerOptions?: ParamsSerializerOptions;
  paramsFilter?: GeneratorMutator;
}

export function generateAxiosOptions({
  response,
  isExactOptionalPropertyTypes,
  angularObserve,
  angularParamsRef,
  requiredNullableQueryParamKeys,
  nonPrimitiveQueryParamKeys,
  objectQueryParamStrategies,
  queryParams,
  headers,
  requestOptions,
  hasSignal,
  hasSignalParam = false,
  isAngular,
  paramsSerializer,
  paramsSerializerOptions,
  paramsFilter,
}: GenerateAxiosOptions) {
  const isRequestOptions = requestOptions !== false;
  const angularPassthroughQueryParamKeys = paramsSerializer
    ? nonPrimitiveQueryParamKeys
    : [];
  // Object-serialization strategies (issue #3705) are, like the passthrough
  // keys above, only meaningful when there's no downstream `paramsSerializer`
  // to hand the raw object to — a configured serializer always wins and
  // receives the untouched value instead.
  const angularObjectParamStrategies = paramsSerializer
    ? {}
    : (objectQueryParamStrategies ?? {});
  // Use querySignal if API has a param named "signal" to avoid conflict
  const signalVar = hasSignalParam ? 'querySignal' : 'signal';
  const signalProp = hasSignalParam ? `signal: ${signalVar}` : 'signal';

  if (
    !queryParams &&
    !headers &&
    !response.isBlob &&
    response.definition.success !== 'string'
  ) {
    if (isRequestOptions) {
      return isAngular
        ? angularObserve
          ? `{
        ...(options as Omit<NonNullable<typeof options>, 'observe'>),
        observe: '${angularObserve}',
      }`
          : "(options as Omit<NonNullable<typeof options>, 'observe'>)"
        : 'options';
    }
    if (hasSignal) {
      return isExactOptionalPropertyTypes
        ? `...(${signalVar} ? { ${signalProp} } : {})`
        : signalProp;
    }
    return '';
  }

  let value = '';

  if (!isRequestOptions) {
    if (queryParams) {
      if (isAngular) {
        const iifeExpr = buildAngularParamsFilterExpression({
          paramsExpression: 'params ?? {}',
          requiredNullableParamKeys: requiredNullableQueryParamKeys,
          preserveRequiredNullables: !!paramsSerializer,
          nonPrimitiveKeys: angularPassthroughQueryParamKeys,
          objectParamStrategies: angularObjectParamStrategies,
          paramsFilter,
          useSharedHelper: false,
        });
        value += paramsSerializer
          ? `\n        params: ${paramsSerializer.name}(${iifeExpr}),`
          : `\n        params: ${iifeExpr},`;
      } else {
        value += '\n        params,';
      }
    }

    if (headers) {
      value += '\n        headers,';
    }

    if (hasSignal) {
      value += isExactOptionalPropertyTypes
        ? `\n        ...(${signalVar} ? { ${signalProp} } : {}),`
        : `\n        ${signalProp},`;
    }
  }

  if (
    !isObject(requestOptions) ||
    !Object.hasOwn(requestOptions, 'responseType')
  ) {
    const successResponseType = getSuccessResponseType(response);
    if (successResponseType) {
      value += `\n        responseType: '${successResponseType}',`;
    }
  }

  if (isObject(requestOptions)) {
    value += `\n ${stringify(requestOptions)?.slice(1, -1)}`;
  }

  if (isRequestOptions) {
    value += isAngular
      ? "\n    ...(options as Omit<NonNullable<typeof options>, 'observe'>),"
      : '\n    ...options,';

    if (isAngular && angularObserve) {
      value += `\n        observe: '${angularObserve}',`;
    }

    if (queryParams) {
      if (isAngular && angularParamsRef) {
        value += `\n        params: ${angularParamsRef},`;
      } else if (isAngular && paramsSerializer) {
        const callExpr = buildAngularParamsFilterExpression({
          paramsExpression: '{...params, ...options?.params}',
          requiredNullableParamKeys: requiredNullableQueryParamKeys,
          preserveRequiredNullables: true,
          nonPrimitiveKeys: angularPassthroughQueryParamKeys,
          objectParamStrategies: angularObjectParamStrategies,
          paramsFilter,
          useSharedHelper: true,
        });
        value += `\n        params: ${paramsSerializer.name}(${callExpr}),`;
      } else if (isAngular) {
        const callExpr = buildAngularParamsFilterExpression({
          paramsExpression: '{...params, ...options?.params}',
          requiredNullableParamKeys: requiredNullableQueryParamKeys,
          nonPrimitiveKeys: angularPassthroughQueryParamKeys,
          objectParamStrategies: angularObjectParamStrategies,
          paramsFilter,
          useSharedHelper: true,
        });
        value += `\n        params: ${callExpr},`;
      } else {
        value += '\n        params: {...params, ...options?.params},';
      }
    }

    if (headers) {
      value += '\n        headers: {...headers, ...options?.headers},';
    }
  }

  if (
    !isAngular &&
    queryParams &&
    (paramsSerializer || paramsSerializerOptions?.qs)
  ) {
    const qsOptions = paramsSerializerOptions?.qs;
    value += paramsSerializer
      ? `\n        paramsSerializer: ${paramsSerializer.name},`
      : `\n        paramsSerializer: (params) => qs.stringify(params, ${JSON.stringify(
          qsOptions,
        )}),`;
  }

  return value;
}

interface GenerateOptionsOptions {
  route: string;
  body: GetterBody;
  angularObserve?: 'body' | 'events' | 'response';
  angularParamsRef?: string;
  headers?: GetterQueryParam;
  queryParams?: GetterQueryParam;
  /**
   * Per-parameter object-serialization strategies (issue #3705), already
   * gated by the caller for `override.angular.queryObjectSerialization` and
   * any configured `paramsFilter`/`paramsSerializer`.
   */
  objectQueryParamStrategies?: Readonly<
    Record<string, AngularObjectParamStrategy>
  >;
  response: GetterResponse;
  verb: Verbs;
  requestOptions?: object | boolean;
  isFormData: boolean;
  isFormUrlEncoded: boolean;
  isAngular?: boolean;
  isExactOptionalPropertyTypes: boolean;
  hasSignal: boolean;
  hasSignalParam?: boolean;
  paramsSerializer?: GeneratorMutator;
  paramsSerializerOptions?: ParamsSerializerOptions;
  paramsFilter?: GeneratorMutator;
}

export function generateOptions({
  route,
  body,
  angularObserve,
  angularParamsRef,
  headers,
  queryParams,
  objectQueryParamStrategies,
  response,
  verb,
  requestOptions,
  isFormData,
  isFormUrlEncoded,
  isAngular,
  isExactOptionalPropertyTypes,
  hasSignal,
  hasSignalParam,
  paramsSerializer,
  paramsSerializerOptions,
  paramsFilter,
}: GenerateOptionsOptions) {
  const bodyIdentifier = getIsBodyVerb(verb)
    ? generateBodyOptions(body, isFormData, isFormUrlEncoded)
    : undefined;

  const axiosOptions = generateAxiosOptions({
    response,
    angularObserve,
    angularParamsRef,
    requiredNullableQueryParamKeys: queryParams?.requiredNullableKeys,
    nonPrimitiveQueryParamKeys: queryParams?.nonPrimitiveKeys,
    objectQueryParamStrategies,
    queryParams: queryParams?.schema,
    headers: headers?.schema,
    requestOptions,
    isExactOptionalPropertyTypes,
    hasSignal,
    hasSignalParam,
    isAngular: isAngular ?? false,
    paramsSerializer,
    paramsSerializerOptions,
    paramsFilter,
  });

  const trimmedAxiosOptions = axiosOptions.trim();
  const isRawOptionsArgument =
    trimmedAxiosOptions === 'options' ||
    (trimmedAxiosOptions.startsWith('(') &&
      trimmedAxiosOptions.endsWith(')')) ||
    (trimmedAxiosOptions.startsWith('{') && trimmedAxiosOptions.endsWith('}'));

  const optionsArgument = axiosOptions
    ? isRawOptionsArgument
      ? axiosOptions
      : `{${axiosOptions}}`
    : '';

  if (verb === Verbs.DELETE) {
    if (!bodyIdentifier) {
      return `\n      \`${route}\`${optionsArgument ? `,${optionsArgument}` : ''}\n    `;
    }

    const deleteBodyOptions = isRawOptionsArgument
      ? `...${optionsArgument}`
      : axiosOptions;
    const deleteBodyField = `${isAngular ? 'body' : 'data'}: ${bodyIdentifier}`;

    return `\n      \`${route}\`,{${deleteBodyField}${axiosOptions ? `,${deleteBodyOptions}` : ''}}\n    `;
  }

  const bodyOrOptions = getIsBodyVerb(verb)
    ? `\n      ${bodyIdentifier ?? 'undefined'},`
    : '';
  const separator = bodyOrOptions || optionsArgument ? ',' : '';

  return `\n      \`${route}\`${separator}${bodyOrOptions}${optionsArgument}\n    `;
}

export function generateBodyMutatorConfig(
  body: GetterBody,
  isFormData: boolean,
  isFormUrlEncoded: boolean,
) {
  if (isFormData && body.formData) {
    return ',\n       data: formData';
  }

  if (isFormUrlEncoded && body.formUrlEncoded) {
    return ',\n       data: formUrlEncoded';
  }

  if (body.implementation) {
    return `,\n      data: ${body.implementation}`;
  }

  return '';
}

export function generateQueryParamsAxiosConfig(
  response: GetterResponse,
  isAngular: boolean,
  requiredNullableQueryParamKeys?: string[],
  queryParams?: GetterQueryParam,
  paramsFilter?: GeneratorMutator,
) {
  if (!queryParams && !response.isBlob) {
    return '';
  }

  let value = '';

  if (queryParams) {
    if (isAngular) {
      const paramsExpr = buildAngularParamsFilterExpression({
        paramsExpression: 'params ?? {}',
        requiredNullableParamKeys: requiredNullableQueryParamKeys,
        nonPrimitiveKeys: queryParams.nonPrimitiveKeys,
        paramsFilter,
        useSharedHelper: false,
      });
      value += `,\n        params: ${paramsExpr}`;
    } else {
      value += ',\n        params';
    }
  }

  if (response.isBlob) {
    value += `,\n        responseType: 'blob'`;
  }

  return value;
}

interface GenerateMutatorConfigOptions {
  route: string;
  body: GetterBody;
  headers?: GetterQueryParam;
  queryParams?: GetterQueryParam;
  response: GetterResponse;
  verb: Verbs;
  isFormData: boolean;
  isFormUrlEncoded: boolean;
  hasSignal: boolean;
  hasSignalParam?: boolean;
  isExactOptionalPropertyTypes: boolean;
  isAngular?: boolean;
  paramsFilter?: GeneratorMutator;
}

export function generateMutatorConfig({
  route,
  body,
  headers,
  queryParams,
  response,
  verb,
  isFormData,
  isFormUrlEncoded,
  hasSignal,
  hasSignalParam = false,
  isExactOptionalPropertyTypes,
  isAngular,
  paramsFilter,
}: GenerateMutatorConfigOptions) {
  const bodyOptions = getIsBodyVerb(verb)
    ? generateBodyMutatorConfig(body, isFormData, isFormUrlEncoded)
    : '';

  const queryParamsOptions = generateQueryParamsAxiosConfig(
    response,
    isAngular ?? false,
    queryParams?.requiredNullableKeys,
    queryParams,
    paramsFilter,
  );

  const ignoreContentTypes = isAngular ? ['multipart/form-data'] : [];
  const shouldSetContentType =
    body.contentType && !ignoreContentTypes.includes(body.contentType);

  const headerOptions = shouldSetContentType
    ? `,\n      headers: {'Content-Type': '${body.contentType}', ${
        headers ? '...headers' : ''
      }}`
    : headers
      ? ',\n      headers'
      : '';

  // Use querySignal if API has a param named "signal" to avoid conflict
  const signalVar = hasSignalParam ? 'querySignal' : 'signal';
  const signalProp = hasSignalParam ? `signal: ${signalVar}` : 'signal';

  return `{url: \`${route}\`, method: '${verb.toUpperCase()}'${headerOptions}${bodyOptions}${queryParamsOptions}${
    hasSignal
      ? `, ${
          isExactOptionalPropertyTypes
            ? `...(${signalVar} ? { ${signalProp} }: {})`
            : signalProp
        }`
      : ''
  }\n    }`;
}

export function generateMutatorRequestOptions(
  requestOptions: boolean | object | undefined,
  hasSecondArgument: boolean,
) {
  if (!hasSecondArgument) {
    return isObject(requestOptions)
      ? `{${stringify(requestOptions)?.slice(1, -1)}}`
      : '';
  }

  if (isObject(requestOptions)) {
    return `{${stringify(requestOptions)?.slice(1, -1)} ...options}`;
  }

  return 'options';
}

export function generateFormDataAndUrlEncodedFunction({
  body,
  formData,
  formUrlEncoded,
  isFormData,
  isFormUrlEncoded,
}: GenerateFormDataAndUrlEncodedFunctionOptions) {
  if (isFormData && body.formData) {
    if (formData) {
      return `const formData = ${formData.name}(${body.implementation})`;
    }

    return body.formData;
  }

  if (isFormUrlEncoded && body.formUrlEncoded) {
    if (formUrlEncoded) {
      return `const formUrlEncoded = ${formUrlEncoded.name}(${body.implementation})`;
    }

    return body.formUrlEncoded;
  }

  return '';
}
