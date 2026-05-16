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
): string => {
  const filteredParamValueType = `string | number | boolean${preserveRequiredNullables ? ' | null' : ''} | Array<string | number | boolean>`;
  const preserveNullableBranch = preserveRequiredNullables
    ? `    } else if (value === null && requiredNullableParamKeys.has(key)) {
      filteredParams[key] = null;
`
    : '';
  const scalarBranch = `    } else if (
      value != null &&
      (typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean')
    ) {
      filteredParams[key] = value;
    }
`;

  return `(() => {
  const requiredNullableParamKeys = new Set<string>(${JSON.stringify(requiredNullableParamKeys)});
  const filteredParams: Record<string, ${filteredParamValueType}> = {};
  for (const [key, value] of Object.entries(${paramsExpression})) {
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
${preserveNullableBranch}${scalarBranch}  }
  return filteredParams;
})()`;
};

/**
 * Returns the body of a standalone `filterParams` helper function
 * to be emitted once in the generated file header, replacing the
 * inline IIFE that was previously duplicated in every method.
 */
export const getAngularFilteredParamsHelperBody = (): string =>
  `type AngularHttpParamValue = string | number | boolean | Array<string | number | boolean>;
type AngularHttpParamValueWithNullable = AngularHttpParamValue | null;

function filterParams(
  params: Record<string, unknown>,
  requiredNullableKeys?: ReadonlySet<string>,
  preserveRequiredNullables?: false,
): Record<string, AngularHttpParamValue>;
function filterParams(
  params: Record<string, unknown>,
  requiredNullableKeys: ReadonlySet<string> | undefined,
  preserveRequiredNullables: true,
): Record<string, AngularHttpParamValueWithNullable>;
function filterParams(
  params: Record<string, unknown>,
  requiredNullableKeys: ReadonlySet<string> = new Set(),
  preserveRequiredNullables = false,
): Record<string, AngularHttpParamValueWithNullable> {
  const filteredParams: Record<string, AngularHttpParamValueWithNullable> = {};
  for (const [key, value] of Object.entries(params)) {
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

/**
 * Returns a call expression to the `filterParams` helper function.
 */
export const getAngularFilteredParamsCallExpression = (
  paramsExpression: string,
  requiredNullableParamKeys: string[] = [],
  preserveRequiredNullables = false,
): string =>
  `filterParams(${paramsExpression}, new Set<string>(${JSON.stringify(requiredNullableParamKeys)})${preserveRequiredNullables ? ', true' : ''})`;

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
  queryParams?: GeneratorSchema;
  headers?: GeneratorSchema;
  requestOptions?: object | boolean;
  hasSignal: boolean;
  hasSignalParam?: boolean;
  isVue: boolean;
  isAngular: boolean;
  paramsSerializer?: GeneratorMutator;
  paramsSerializerOptions?: ParamsSerializerOptions;
}

export function generateAxiosOptions({
  response,
  isExactOptionalPropertyTypes,
  angularObserve,
  angularParamsRef,
  requiredNullableQueryParamKeys,
  queryParams,
  headers,
  requestOptions,
  hasSignal,
  hasSignalParam = false,
  isVue,
  isAngular,
  paramsSerializer,
  paramsSerializerOptions,
}: GenerateAxiosOptions) {
  const isRequestOptions = requestOptions !== false;
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
        const iifeExpr = getAngularFilteredParamsExpression(
          'params ?? {}',
          requiredNullableQueryParamKeys,
          !!paramsSerializer,
        );
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
      if (isVue) {
        value += '\n        params: {...unref(params), ...options?.params},';
      } else if (isAngular && angularParamsRef) {
        value += `\n        params: ${angularParamsRef},`;
      } else if (isAngular && paramsSerializer) {
        const callExpr = getAngularFilteredParamsCallExpression(
          '{...params, ...options?.params}',
          requiredNullableQueryParamKeys,
          true,
        );
        value += `\n        params: ${paramsSerializer.name}(${callExpr}),`;
      } else if (isAngular) {
        value += `\n        params: ${getAngularFilteredParamsCallExpression('{...params, ...options?.params}', requiredNullableQueryParamKeys)},`;
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
  response: GetterResponse;
  verb: Verbs;
  requestOptions?: object | boolean;
  isFormData: boolean;
  isFormUrlEncoded: boolean;
  isAngular?: boolean;
  isExactOptionalPropertyTypes: boolean;
  hasSignal: boolean;
  hasSignalParam?: boolean;
  isVue?: boolean;
  paramsSerializer?: GeneratorMutator;
  paramsSerializerOptions?: ParamsSerializerOptions;
}

export function generateOptions({
  route,
  body,
  angularObserve,
  angularParamsRef,
  headers,
  queryParams,
  response,
  verb,
  requestOptions,
  isFormData,
  isFormUrlEncoded,
  isAngular,
  isExactOptionalPropertyTypes,
  hasSignal,
  hasSignalParam,
  isVue,
  paramsSerializer,
  paramsSerializerOptions,
}: GenerateOptionsOptions) {
  const bodyIdentifier = getIsBodyVerb(verb)
    ? generateBodyOptions(body, isFormData, isFormUrlEncoded)
    : undefined;

  const axiosOptions = generateAxiosOptions({
    response,
    angularObserve,
    angularParamsRef,
    requiredNullableQueryParamKeys: queryParams?.requiredNullableKeys,
    queryParams: queryParams?.schema,
    headers: headers?.schema,
    requestOptions,
    isExactOptionalPropertyTypes,
    hasSignal,
    hasSignalParam,
    isVue: isVue ?? false,
    isAngular: isAngular ?? false,
    paramsSerializer,
    paramsSerializerOptions,
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
  isVue: boolean,
  isAngular: boolean,
  requiredNullableQueryParamKeys?: string[],
  queryParams?: GetterQueryParam,
) {
  if (!queryParams && !response.isBlob) {
    return '';
  }

  let value = '';

  if (queryParams) {
    if (isVue) {
      value += ',\n        params: unref(params)';
    } else if (isAngular) {
      value += `,\n        params: ${getAngularFilteredParamsExpression('params ?? {}', requiredNullableQueryParamKeys)}`;
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
  isVue?: boolean;
  isAngular?: boolean;
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
  isVue,
  isAngular,
}: GenerateMutatorConfigOptions) {
  const bodyOptions = getIsBodyVerb(verb)
    ? generateBodyMutatorConfig(body, isFormData, isFormUrlEncoded)
    : '';

  const queryParamsOptions = generateQueryParamsAxiosConfig(
    response,
    isVue ?? false,
    isAngular ?? false,
    queryParams?.requiredNullableKeys,
    queryParams,
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
