import type {
  GeneratorOptions,
  GeneratorVerbOptions,
  GetterProp,
} from '@orval/core';
import { GetterPropType, OutputHttpClient, Verbs } from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import { generateSwrRequestFunction } from './client';

describe('query parameter type extraction', () => {
  it('extracts type name from query param GetterProp', () => {
    const queryParamProp: GetterProp = {
      name: 'params',
      definition: 'params: ListPetsParams',
      implementation: 'params: ListPetsParams',
      default: false,
      required: true,
      type: GetterPropType.QUERY_PARAM,
    };

    const props: GetterProp[] = [queryParamProp];
    const queryParam = props.find(
      (prop) => prop.type === GetterPropType.QUERY_PARAM,
    );
    const extractedType = queryParam?.definition.split(': ')[1] ?? 'never';

    expect(extractedType).toBe('ListPetsParams');
  });

  it('extracts type name from optional query param', () => {
    const queryParamProp: GetterProp = {
      name: 'params',
      definition: 'params?: GetUsersParams',
      implementation: 'params?: GetUsersParams',
      default: false,
      required: false,
      type: GetterPropType.QUERY_PARAM,
    };

    const props: GetterProp[] = [queryParamProp];
    const queryParam = props.find(
      (prop) => prop.type === GetterPropType.QUERY_PARAM,
    );
    const extractedType = queryParam?.definition.split(': ')[1] ?? 'never';

    expect(extractedType).toBe('GetUsersParams');
  });

  it('returns never when no query param exists', () => {
    const pathParamProp: GetterProp = {
      name: 'id',
      definition: 'id: string',
      implementation: 'id: string',
      default: false,
      required: true,
      type: GetterPropType.PARAM,
    };

    const props: GetterProp[] = [pathParamProp];
    const queryParam = props.find(
      (prop) => prop.type === GetterPropType.QUERY_PARAM,
    );
    const extractedType = queryParam?.definition.split(': ')[1] ?? 'never';

    expect(extractedType).toBe('never');
  });
});

const createVerbOptions = (definition: string): GeneratorVerbOptions =>
  ({
    operationId: 'createPet',
    operationName: 'createPet',
    typeName: 'createPet',
    verb: Verbs.POST,
    route: '/pets',
    pathRoute: '/pets',
    tags: [],
    summary: '',
    doc: '',
    response: {
      imports: [],
      definition: { success: 'Pet', errors: 'unknown' },
      isBlob: false,
      types: { success: [], errors: [] },
      contentTypes: ['application/json'],
      schemas: [],
    },
    body: {
      implementation: 'pet',
      definition,
      imports: [],
      schemas: [],
      originalSchema: {},
      contentType: 'application/json',
      formData: '',
      formUrlEncoded: '',
      isOptional: false,
      isBlob: false,
    },
    headers: undefined,
    queryParams: undefined,
    params: [],
    props: [
      {
        name: 'petId',
        definition: 'petId: PetStatus',
        implementation: 'petId: PetStatus',
        default: false,
        required: true,
        type: GetterPropType.PARAM,
      },
      {
        name: 'pet',
        definition: `pet: ${definition}`,
        implementation: `pet: ${definition}`,
        default: false,
        required: true,
        type: GetterPropType.BODY,
      },
    ],
    mutator: {
      name: 'customInstance',
      path: './custom-instance',
      default: false,
      hasErrorType: false,
      errorTypeName: '',
      hasSecondArg: false,
      hasThirdArg: false,
      isHook: false,
      bodyTypeName: 'BodyType',
    },
    formData: undefined,
    formUrlEncoded: undefined,
    paramsSerializer: undefined,
    override: {
      requestOptions: true,
      formData: { disabled: true, arrayHandling: 'serialize' },
      formUrlEncoded: true,
      paramsSerializerOptions: undefined,
    },
    originalOperation: {},
  }) as unknown as GeneratorVerbOptions;

const generatorOptions = {
  route: '/pets',
  pathRoute: '/pets',
  context: {
    output: {
      httpClient: OutputHttpClient.AXIOS,
      tsconfig: { compilerOptions: { allowSyntheticDefaultImports: true } },
    },
  },
} as unknown as GeneratorOptions;

describe('swr mutator body type', () => {
  it.each([['Pet'], ['Pet[]'], ['Pet | Cat'], ["'$1' | 'b'"], ["'$&'"]])(
    'wraps a %s body in the mutator BodyType envelope',
    (definition) => {
      const implementation = generateSwrRequestFunction(
        createVerbOptions(definition),
        generatorOptions,
      );

      expect(implementation).toContain(
        `petId: PetStatus,\n    pet: BodyType<${definition}>,\n`,
      );
    },
  );

  it('wraps the body rather than a path param of the same type', () => {
    const implementation = generateSwrRequestFunction(
      createVerbOptions('PetStatus'),
      generatorOptions,
    );

    expect(implementation).toContain(
      `petId: PetStatus,\n    pet: BodyType<PetStatus>,\n`,
    );
  });
});
