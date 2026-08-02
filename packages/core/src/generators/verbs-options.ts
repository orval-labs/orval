import {
  getBodiesByContentType,
  getBody,
  getOperationId,
  getParameters,
  getParams,
  getProps,
  getQueryParams,
  getResponse,
} from '../getters';
import type {
  ContextSpec,
  GeneratorVerbOptions,
  GeneratorVerbsOptions,
  GetterBody,
  GetterParams,
  NormalizedInputOptions,
  NormalizedMutator,
  NormalizedOperationOptions,
  NormalizedOutputOptions,
  NormalizedOverrideOutput,
  OpenApiComponentsObject,
  OpenApiOperationObject,
  OpenApiPathItemObject,
  OpenApiRequestBodyObject,
  Verbs,
} from '../types';
import {
  asyncReduce,
  camel,
  dynamicImport,
  escapeRegExp,
  isObject,
  isString,
  isVerb,
  jsDoc,
  mergeDeep,
  sanitize,
} from '../utils';
import { filteredVerbs } from './input-filters';
import { generateMutator } from './mutator';

export interface GenerateVerbOptionsParams {
  verb: Verbs;
  output: NormalizedOutputOptions;
  operation: OpenApiOperationObject;
  route: string;
  pathRoute: string;
  verbParameters?: OpenApiPathItemObject['parameters'];
  components?: OpenApiComponentsObject;
  context: ContextSpec;
}

const renameFormIdentifier = (form: string, from: string, to: string) =>
  form.replace(
    new RegExp(`(?<![.\\w$'"\`])${escapeRegExp(from)}(?![\\w$])`, 'g'),
    to,
  );

// A body parameter named like the generated function shadows it inside hooks
// that reference `typeof <operationName>`.
const resolveBodyNameShadowing = (
  body: GetterBody,
  operationName: string,
  params: GetterParams,
): GetterBody => {
  if (!body.implementation || body.implementation !== operationName) {
    return body;
  }

  const reservedNames = new Set([
    operationName,
    'params',
    'headers',
    ...params.map(({ name }) => name),
  ]);
  let implementation = camel(`${operationName}-body`);
  let index = 2;
  while (reservedNames.has(implementation)) {
    implementation = camel(`${operationName}-body-${index}`);
    index += 1;
  }

  return {
    ...body,
    implementation,
    formData:
      body.formData &&
      renameFormIdentifier(body.formData, body.implementation, implementation),
    formUrlEncoded:
      body.formUrlEncoded &&
      renameFormIdentifier(
        body.formUrlEncoded,
        body.implementation,
        implementation,
      ),
  };
};

async function buildVerbOption({
  verb,
  output,
  operation,
  route,
  pathRoute,
  verbParameters = [],
  context,
  body: rawBody,
  operationName,
  typeName,
  operationId,
  override,
  tags,
  deprecated,
  description,
  summary,
}: {
  verb: Verbs;
  output: NormalizedOutputOptions;
  operation: OpenApiOperationObject;
  route: string;
  pathRoute: string;
  verbParameters: OpenApiPathItemObject['parameters'];
  context: ContextSpec;
  body: GetterBody;
  operationName: string;
  typeName: string;
  operationId: string;
  override: NormalizedOverrideOutput;
  tags: string[];
  deprecated: boolean | undefined;
  description: string | undefined;
  summary: string | undefined;
}): Promise<GeneratorVerbOptions> {
  const response = getResponse({
    responses: operation.responses ?? {},
    operationName: typeName,
    context,
    contentType: override.contentType,
  });

  const parameters = getParameters({
    parameters: [...verbParameters, ...(operation.parameters ?? [])],
    context,
  });

  const queryParams = getQueryParams({
    queryParams: parameters.query,
    operationName: typeName,
    context,
  });

  const headers = output.headers
    ? getQueryParams({
        queryParams: parameters.header,
        operationName: typeName,
        context,
        suffix: 'headers',
      })
    : undefined;

  const params = getParams({
    route,
    pathParams: parameters.path,
    operationId,
    context,
    output,
  });

  const body = resolveBodyNameShadowing(rawBody, operationName, params);

  const props = getProps({
    body,
    queryParams,
    params,
    headers,
    operationName: typeName,
    context,
  });

  const mutator = await generateMutator({
    output: output.target,
    name: typeName,
    mutator: override.mutator,
    workspace: context.workspace,
    tsconfig: context.output.tsconfig,
  });

  const formData =
    !override.formData.disabled && body.formData
      ? await generateMutator({
          output: output.target,
          name: typeName,
          mutator: override.formData.mutator,
          workspace: context.workspace,
          tsconfig: context.output.tsconfig,
        })
      : undefined;

  const formUrlEncoded =
    isString(override.formUrlEncoded) || isObject(override.formUrlEncoded)
      ? await generateMutator({
          output: output.target,
          name: typeName,
          mutator: override.formUrlEncoded as NormalizedMutator,
          workspace: context.workspace,
          tsconfig: context.output.tsconfig,
        })
      : undefined;

  const paramsSerializer =
    isString(override.paramsSerializer) || isObject(override.paramsSerializer)
      ? await generateMutator({
          output: output.target,
          name: 'paramsSerializer',
          mutator: override.paramsSerializer as NormalizedMutator,
          workspace: context.workspace,
          tsconfig: context.output.tsconfig,
        })
      : undefined;

  const paramsFilter =
    isString(override.paramsFilter) || isObject(override.paramsFilter)
      ? await generateMutator({
          output: output.target,
          name: 'paramsFilter',
          mutator: override.paramsFilter as NormalizedMutator,
          workspace: context.workspace,
          tsconfig: context.output.tsconfig,
        })
      : undefined;

  const fetchReviver =
    isString(override.fetch.jsonReviver) || isObject(override.fetch.jsonReviver)
      ? await generateMutator({
          output: output.target,
          name: 'fetchReviver',
          mutator: override.fetch.jsonReviver as NormalizedMutator,
          workspace: context.workspace,
          tsconfig: context.output.tsconfig,
        })
      : undefined;
  const doc = jsDoc({ description, deprecated, summary });

  const verbOption: GeneratorVerbOptions = {
    verb,
    tags,
    route,
    pathRoute,
    summary,
    operationId,
    operationName,
    typeName,
    response,
    body,
    headers,
    queryParams,
    params,
    props,
    mutator,
    formData,
    formUrlEncoded,
    paramsSerializer,
    paramsFilter,
    fetchReviver,
    override,
    doc,
    deprecated,
    originalOperation: operation,
  };

  const transformer = await dynamicImport(
    override.transformer,
    context.workspace,
  );

  return transformer ? transformer(verbOption) : verbOption;
}

export async function generateVerbOptions({
  verb,
  output,
  operation,
  route,
  pathRoute,
  verbParameters = [],
  context,
}: GenerateVerbOptionsParams): Promise<GeneratorVerbOptions[]> {
  const {
    requestBody,
    tags: rawTags,
    deprecated: rawDeprecated,
    description: rawDescription,
    summary: rawSummary,
  } = operation;

  // Bridge assertions: OpenApiOperationObject has AnyOtherAttribute index signature
  // which makes all destructured properties `any`. Assert to their declared types.
  const tags = (rawTags ?? []) as string[];
  const deprecated = rawDeprecated as boolean | undefined;
  const description = rawDescription as string | undefined;
  const summary = rawSummary as string | undefined;
  const operationId = getOperationId(operation, route, verb);
  const overrideOperation = output.override.operations[operationId];
  let overrideTag: NormalizedOperationOptions = {};
  for (const [tag, options] of Object.entries(output.override.tags)) {
    if (tags.includes(tag) && options) {
      overrideTag = mergeDeep(overrideTag, options);
    }
  }

  const override = mergeDeep(
    mergeDeep(output.override, overrideTag),
    overrideOperation ?? {},
  ) as NormalizedOverrideOutput;

  const overrideOperationName =
    overrideOperation?.operationName ?? output.override.operationName;
  let operationName: string;
  let typeName: string;
  if (overrideOperationName) {
    // ponytail: user-provided override is authoritative; sanitize would strip
    // intentional `_` and `$` (regression introduced in #3693, fixed per #3775).
    const result = overrideOperationName(operation, route, verb);
    if (Array.isArray(result)) {
      operationName = result[0];
      typeName = result[1];
    } else {
      operationName = result;
      typeName = operationName;
    }
  } else {
    operationName = sanitize(camel(operationId), { es5keyword: true });
    typeName = operationName;
  }

  const splitByContentType = override.splitByContentType;

  if (splitByContentType && requestBody) {
    const bodies = getBodiesByContentType({
      requestBody,
      operationName: typeName,
      context,
      contentType: override.contentType,
    });

    const results: GeneratorVerbOptions[] = [];
    for (const bodyEntry of bodies) {
      const { contentTypeSuffix, ...body } = bodyEntry;
      const suffixedName = contentTypeSuffix
        ? `${operationName}With${contentTypeSuffix}`
        : operationName;
      const suffixedTypeName = contentTypeSuffix
        ? `${typeName}With${contentTypeSuffix}`
        : typeName;

      const verbOption = await buildVerbOption({
        verb,
        output,
        operation,
        route,
        pathRoute,
        verbParameters,
        context,
        body,
        operationName: suffixedName,
        typeName: suffixedTypeName,
        operationId,
        override,
        tags,
        deprecated,
        description,
        summary,
      });
      results.push(verbOption);
    }
    return results;
  }

  const body = requestBody
    ? getBody({
        requestBody,
        operationName: typeName,
        context,
        contentType: override.contentType,
      })
    : {
        originalSchema: {} as OpenApiRequestBodyObject,
        definition: '',
        implementation: '',
        imports: [],
        schemas: [],
        formData: '',
        formUrlEncoded: '',
        contentType: '',
        isOptional: false,
      };

  const verbOption = await buildVerbOption({
    verb,
    output,
    operation,
    route,
    pathRoute,
    verbParameters,
    context,
    body,
    operationName,
    typeName,
    operationId,
    override,
    tags,
    deprecated,
    description,
    summary,
  });

  return [verbOption];
}

export interface GenerateVerbsOptionsParams {
  verbs: OpenApiPathItemObject;
  input: NormalizedInputOptions;
  output: NormalizedOutputOptions;
  route: string;
  pathRoute: string;
  context: ContextSpec;
}

export function generateVerbsOptions({
  verbs,
  input,
  output,
  route,
  pathRoute,
  context,
}: GenerateVerbsOptionsParams): Promise<GeneratorVerbsOptions> {
  return asyncReduce(
    filteredVerbs(verbs, input.filters),
    async (acc, [verb, operation]: [string, OpenApiOperationObject]) => {
      if (isVerb(verb)) {
        const verbOptions = await generateVerbOptions({
          verb,
          output,
          verbParameters: verbs.parameters,
          route,
          pathRoute,
          operation,
          context,
        });

        acc.push(...verbOptions);
      }

      return acc;
    },
    [] as GeneratorVerbsOptions,
  );
}
