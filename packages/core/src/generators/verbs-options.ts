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
  getOperationTagKey,
  getUniqueName,
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
  // Names already taken by another operation of the same output. Colliding
  // names used to be emitted verbatim, which produces uncompilable output
  // (TS2451/TS2300 within a file, TS2308 through a barrel). #2685
  reservedOperationNames?: Set<string>;
  reservedTypeNames?: Set<string>;
  /**
   * Per-tag method-name reservation sets. Provided only when the output
   * renders one class per tag bucket and methods therefore only need to be
   * unique within their tag (built-in Angular `httpClient` in `tags` /
   * `tags-split` modes). Keyed by the canonical `getOperationTagKey` bucket.
   */
  reservedMethodNamesByTag?: Map<string, Set<string>>;
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
  methodName,
  reservedMethodNamesByTag,
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
  methodName?: string;
  reservedMethodNamesByTag?: Map<string, Set<string>>;
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
    generatePrimitiveSchemas:
      !override.mutator &&
      isObject(output.schemas) &&
      output.schemas.type === 'zod' &&
      (output.client === 'angular'
        ? override.angular.runtimeValidation.enabled
        : output.client === 'angular-query'
          ? override.query.runtimeValidation?.enabled
          : (output.client === 'fetch' || output.httpClient === 'fetch') &&
            override.fetch.runtimeValidation.enabled),
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
    pathRoute,
    pathParams: parameters.path,
    operationId,
    context,
    output,
  });

  // A body parameter named like the generated method shadows it inside hooks
  // that reference `typeof <operationName>`. The shadow check runs against the
  // class-local method name when one is assigned (Angular tag-scoped classes):
  // that is the identifier the generated method actually declares.
  const body = resolveBodyNameShadowing(
    rawBody,
    methodName ?? operationName,
    params,
  );

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
    ...(methodName && methodName !== operationName ? { methodName } : {}),
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

  const transformed = transformer ? transformer(verbOption) : verbOption;
  if (
    reservedMethodNamesByTag &&
    (!transformed.deprecated ||
      output.override.useDeprecatedOperations !== false)
  ) {
    // Reserve against the writer's final bucket, after both in-place and
    // returned-object transformers have had a chance to change names/tags.
    const candidate =
      transformed.operationName !== operationName
        ? transformed.operationName
        : (transformed.methodName ?? methodName ?? transformed.operationName);
    const tagKey = getOperationTagKey(transformed);
    let names = reservedMethodNamesByTag.get(tagKey);
    if (!names) {
      names = new Set();
      reservedMethodNamesByTag.set(tagKey, names);
    }
    const finalMethodName = getUniqueName(candidate, names);
    names.add(finalMethodName);
    if (finalMethodName !== transformed.operationName) {
      transformed.methodName = finalMethodName;
    } else {
      delete transformed.methodName;
    }

    // A suffix or transformer rename can introduce a new body-name shadow.
    const finalBody = resolveBodyNameShadowing(
      transformed.body,
      finalMethodName,
      transformed.params,
    );
    if (finalBody !== transformed.body) {
      const previousName = transformed.body.implementation;
      transformed.body = finalBody;
      transformed.props = transformed.props.map((prop) =>
        prop.name === previousName
          ? {
              ...prop,
              name: finalBody.implementation,
              definition: renameFormIdentifier(
                prop.definition,
                previousName,
                finalBody.implementation,
              ),
              implementation: renameFormIdentifier(
                prop.implementation,
                previousName,
                finalBody.implementation,
              ),
            }
          : prop,
      );
    }
  }
  return transformed;
}

export async function generateVerbOptions({
  verb,
  output,
  operation,
  route,
  pathRoute,
  verbParameters = [],
  context,
  reservedOperationNames,
  reservedTypeNames,
  reservedMethodNamesByTag,
}: GenerateVerbOptionsParams): Promise<GeneratorVerbOptions[]> {
  const {
    requestBody,
    tags: rawTags,
    deprecated: rawDeprecated,
    description: rawDescription,
    summary: rawSummary,
  } = operation;

  const tags = rawTags ?? [];
  const deprecated = rawDeprecated;
  const description = rawDescription;
  const summary = rawSummary;
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
  if (overrideOperation?.zod?.schemaExtension !== undefined) {
    override.zod.schemaExtension = overrideOperation.zod.schemaExtension;
  }
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

  // Two operations can resolve to the same name (a `operationName` override
  // returning a constant, or ids that sanitize together). They used to be
  // emitted verbatim, so a file got two `export const update` declarations
  // (TS2451) and a barrel re-exported the same name twice (TS2308). Reserve
  // the first spelling and suffix the rest. The base name is reserved before
  // the `splitByContentType` fan-out so a suffixed base stays consistent
  // across its variants, and each emitted variant name is reserved as well so
  // a later operation cannot reuse it. An operation that
  // `useDeprecatedOperations: false` drops afterwards reserves nothing, so it
  // cannot push a suffix onto an active one. #2685
  const shouldReserve =
    !deprecated || output.override.useDeprecatedOperations !== false;
  const reserve = (name: string, reservedNames?: Set<string>) => {
    if (!shouldReserve || !reservedNames) {
      return name;
    }
    const uniqueName = getUniqueName(name, reservedNames);
    reservedNames.add(uniqueName);
    return uniqueName;
  };

  // Class-local method names (see GenerateVerbOptionsParams). The bare,
  // pre-reservation spelling is the class-local candidate: a globally
  // suffixed name (e.g. `getStatus2`) must not leak a phantom "2" into a
  // class whose tag never saw the first `getStatus`.
  const bareOperationName = operationName;
  operationName = reserve(bareOperationName, reservedOperationNames);
  typeName = reserve(typeName, reservedTypeNames);
  const baseMethodName = reservedMethodNamesByTag
    ? bareOperationName
    : undefined;

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
        ? reserve(
            `${operationName}With${contentTypeSuffix}`,
            reservedOperationNames,
          )
        : operationName;
      const suffixedTypeName = contentTypeSuffix
        ? reserve(`${typeName}With${contentTypeSuffix}`, reservedTypeNames)
        : typeName;
      const suffixedMethodName =
        baseMethodName !== undefined && contentTypeSuffix
          ? `${baseMethodName}With${contentTypeSuffix}`
          : baseMethodName;

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
        methodName: suffixedMethodName,
        reservedMethodNamesByTag,
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
        isBlob: false,
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
    methodName: baseMethodName,
    reservedMethodNamesByTag,
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
  /** See {@link GenerateVerbOptionsParams.reservedOperationNames}. */
  reservedOperationNames?: Set<string>;
  /** See {@link GenerateVerbOptionsParams.reservedTypeNames}. */
  reservedTypeNames?: Set<string>;
  /** See {@link GenerateVerbOptionsParams.reservedMethodNamesByTag}. */
  reservedMethodNamesByTag?: Map<string, Set<string>>;
}

export function generateVerbsOptions({
  verbs,
  input,
  output,
  route,
  pathRoute,
  context,
  reservedOperationNames,
  reservedTypeNames,
  reservedMethodNamesByTag,
}: GenerateVerbsOptionsParams): Promise<GeneratorVerbsOptions> {
  return asyncReduce(
    filteredVerbs(verbs, input.filters),
    async (acc, [verb, operation]) => {
      if (isVerb(verb)) {
        const verbOptions = await generateVerbOptions({
          verb,
          output,
          verbParameters: verbs.parameters,
          route,
          pathRoute,
          operation,
          context,
          reservedOperationNames,
          reservedTypeNames,
          reservedMethodNamesByTag,
        });

        acc.push(...verbOptions);
      }

      return acc;
    },
    [] as GeneratorVerbsOptions,
  );
}
