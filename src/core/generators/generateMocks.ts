import {OpenAPIObject, SchemaObject} from 'openapi3-ts';
import {generalJSTypesWithArray} from '../../constants';
import {MockOptions} from '../../types';
import {
  GeneratorVerbOptions,
  GeneratorVerbsOptions
} from '../../types/generator';
import {GetterResponse} from '../../types/getters';
import {stringify} from '../../utils/stringify';
import {getMockScalar} from '../getters/getMockScalar';

const getMockPropertiesWithoutFunc = (properties: any, specs: OpenAPIObject) =>
  Object.entries(
    typeof properties === 'function' ? properties(specs) : properties
  ).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]:
        typeof value === 'function'
          ? `(${value})()`
          : stringify(value as string)
    }),
    {}
  );

const getMockWithoutFunc = (
  specs: OpenAPIObject,
  mockOptions?: MockOptions
) => ({
  ...mockOptions,
  ...(mockOptions?.properties
    ? {
        properties: getMockPropertiesWithoutFunc(mockOptions.properties, specs)
      }
    : {}),
  ...(mockOptions?.responses
    ? {
        responses: Object.entries(mockOptions.responses).reduce(
          (acc, [key, value]) => ({
            ...acc,
            [key]: {
              ...value,
              ...(value.properties
                ? {
                    properties: getMockPropertiesWithoutFunc(
                      value.properties,
                      specs
                    )
                  }
                : {})
            }
          }),
          {}
        )
      }
    : {})
});

const toAxiosPromiseMock = (value: unknown, definition: string) =>
  `Promise.resolve(${value}).then(data => ({data})) as AxiosPromise<${definition}>`;

const getResponsesMockDefinition = (
  operationId: string,
  response: GetterResponse,
  schemas: {
    [key: string]: SchemaObject;
  },
  mockOptionsWithoutFunc: MockOptions
) => {
  return response.types.reduce(
    (acc, {value: type}) => {
      if (!type || generalJSTypesWithArray.includes(type)) {
        acc.definitions = [
          ...acc.definitions,
          toAxiosPromiseMock(undefined, response.definition)
        ];
        return acc;
      }

      const schema = {name: type, ...schemas[type]};
      if (!schema) {
        return acc;
      }

      const {value, imports} = getMockScalar({
        item: schema,
        schemas,
        mockOptions: mockOptionsWithoutFunc,
        operationId
      });

      acc.imports = [...acc.imports, ...imports];
      acc.definitions = [
        ...acc.definitions,
        toAxiosPromiseMock(value, response.definition)
      ];

      return acc;
    },
    {
      definitions: [] as string[],
      imports: [] as string[]
    }
  );
};

const getMockDefinition = (
  operationId: string,
  response: GetterResponse,
  specs: OpenAPIObject,
  mockOptions?: MockOptions
) => {
  const schemas = Object.entries(specs.components?.schemas || []).reduce(
    (acc, [name, type]) => ({...acc, [name]: type}),
    {}
  ) as {[key: string]: SchemaObject};

  const mockOptionsWithoutFunc = getMockWithoutFunc(specs, mockOptions);

  const {definitions, imports} = getResponsesMockDefinition(
    operationId,
    response,
    schemas,
    mockOptionsWithoutFunc
  );

  return {
    definition: '[' + definitions.join(', ') + ']',
    definitions,
    imports
  };
};

const getMockOptionsDataOverride = (
  operationId: string,
  mockOptions?: MockOptions
) => {
  return typeof mockOptions?.responses?.[operationId]?.data === 'function'
    ? `(${mockOptions?.responses?.[operationId]?.data})()`
    : stringify(mockOptions?.responses?.[operationId]?.data);
};

const generateMockImplementation = (
  {operationId, response, definitionName, props}: GeneratorVerbOptions,
  specs: OpenAPIObject,
  mockOptions?: MockOptions
) => {
  const {definition, definitions, imports} = getMockDefinition(
    operationId,
    response,
    specs,
    mockOptions
  );

  const mockData = getMockOptionsDataOverride(operationId, mockOptions);

  const implementation = `  ${definitionName}(${
    props.definition
  }): AxiosPromise<${response.definition}> {
    return ${
      mockData
        ? toAxiosPromiseMock(mockData, response.definition)
        : definitions.length > 1
        ? `faker.helpers.randomize(${definition})`
        : definitions[0]
    }
  },
`;

  return {implementation, imports};
};

export const generateMocks = (
  verbsOptions: GeneratorVerbsOptions,
  mockOptions: MockOptions,
  specs: OpenAPIObject,
) => {
  return verbsOptions.reduce(
    (acc, verbOption) => {
      const {implementation, imports} = generateMockImplementation(
        verbOption,
        specs,
        mockOptions
      );
      acc.implementation += implementation;
      acc.imports = [...acc.imports, ...imports];
      return acc;
    },
    {
      implementation: '',
      imports: [] as string[]
    }
  );
};
