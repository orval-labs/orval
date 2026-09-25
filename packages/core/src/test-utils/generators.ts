import {
  type GeneratorOptions,
  type GeneratorVerbOptions,
  GetterPropType,
  type ResReqTypesValue,
  Verbs,
} from '../types';
import {
  type CreateTestContextSpecOptions,
  createTestContextSpec,
  mergeTestOverride,
  type TestOverride,
} from './context';

export interface CreateTestGeneratorOptions {
  route?: string;
  pathRoute?: string;
  output?: string;
  mock?: GeneratorOptions['mock'];
  override?: TestOverride;
  context?: CreateTestContextSpecOptions;
}

export function createTestGeneratorOptions(
  overrides: CreateTestGeneratorOptions = {},
): GeneratorOptions {
  const context = createTestContextSpec({
    ...overrides.context,
    override: {
      ...overrides.context?.override,
      ...overrides.override,
    },
  });
  const override = mergeTestOverride(
    context.output.override,
    overrides.context?.override,
    overrides.override,
  );

  return {
    route: overrides.route ?? overrides.pathRoute ?? '/',
    pathRoute: overrides.pathRoute ?? overrides.route ?? '/',
    override,
    context: {
      ...context,
      output: {
        ...context.output,
        override,
      },
    },
    output: overrides.output ?? '',
    ...(overrides.mock === undefined ? {} : { mock: overrides.mock }),
  } satisfies GeneratorOptions;
}

export type CreateTestResReqTypesValue = Partial<ResReqTypesValue>;

export function createTestResReqTypesValue(
  overrides: CreateTestResReqTypesValue = {},
): ResReqTypesValue {
  return {
    value: '',
    isEnum: false,
    hasReadonlyProps: false,
    type: 'unknown',
    imports: [],
    schemas: [],
    isRef: false,
    dependencies: [],
    key: '200',
    contentType: 'application/json',
    ...overrides,
  } satisfies ResReqTypesValue;
}

export interface CreateTestGeneratorVerbOptions extends Partial<
  Omit<GeneratorVerbOptions, 'override' | 'response' | 'body'>
> {
  override?: TestOverride;
  response?: Omit<
    Partial<GeneratorVerbOptions['response']>,
    'definition' | 'types'
  > & {
    definition?: Partial<GeneratorVerbOptions['response']['definition']>;
    types?: {
      success?: CreateTestResReqTypesValue[];
      errors?: CreateTestResReqTypesValue[];
    };
  };
  body?: Partial<GeneratorVerbOptions['body']>;
}

export function createTestGeneratorVerbOptions(
  overrides: CreateTestGeneratorVerbOptions = {},
): GeneratorVerbOptions {
  const override = mergeTestOverride(
    createTestContextSpec().output.override,
    overrides.override,
  );
  const operationName = overrides.operationName ?? 'testOperation';

  return {
    verb: overrides.verb ?? Verbs.GET,
    route: overrides.route ?? '/',
    pathRoute: overrides.pathRoute ?? '/',
    summary: overrides.summary ?? '',
    doc: overrides.doc ?? '',
    tags: overrides.tags ?? [],
    operationId: overrides.operationId ?? operationName,
    operationName,
    urlHelperName: overrides.urlHelperName,
    typeName: overrides.typeName ?? operationName,
    response: {
      imports: [],
      isBlob: false,
      contentTypes: [],
      schemas: [],
      ...overrides.response,
      definition: {
        success: '',
        errors: '',
        ...overrides.response?.definition,
      },
      types: {
        success: (overrides.response?.types?.success ?? []).map((item) =>
          createTestResReqTypesValue(item),
        ),
        errors: (overrides.response?.types?.errors ?? []).map((item) =>
          createTestResReqTypesValue(item),
        ),
      },
    },
    body: {
      originalSchema: { content: {} },
      imports: [],
      definition: '',
      implementation: '',
      schemas: [],
      contentType: '',
      isOptional: true,
      isBlob: false,
      ...overrides.body,
    },
    headers: overrides.headers,
    queryParams: overrides.queryParams,
    params: overrides.params ?? [],
    props:
      overrides.props ??
      (overrides.params === undefined
        ? []
        : overrides.params.map((param) => ({
            name: param.name,
            definition: param.definition,
            implementation: param.implementation,
            default: param.default,
            required: param.required,
            type: GetterPropType.PARAM,
          }))),
    mutator: overrides.mutator,
    formData: overrides.formData,
    formUrlEncoded: overrides.formUrlEncoded,
    paramsSerializer: overrides.paramsSerializer,
    paramsFilter: overrides.paramsFilter,
    fetchReviver: overrides.fetchReviver,
    override,
    deprecated: overrides.deprecated,
    originalOperation: overrides.originalOperation ?? {},
  } satisfies GeneratorVerbOptions;
}
