import { OpenAPIObject } from 'openapi3-ts';
import { OverrideOutput } from '../../types';
import { GeneratorVerbOptions } from '../../types/generator';
import { getMockDefinition, getMockOptionsDataOverride } from './mocks';

const toAxiosPromiseMock = (value: unknown, definition: string) =>
  `Promise.resolve(${value}).then(data => ({data})) as AxiosPromise<${definition}>`;

export const generateAxiosMock = (
  { operationId, response, definitionName, props }: GeneratorVerbOptions,
  specs: OpenAPIObject,
  override?: OverrideOutput,
) => {
  const { definition, definitions, imports } = getMockDefinition(
    operationId,
    response,
    specs,
    override,
    toAxiosPromiseMock,
  );

  const mockData = getMockOptionsDataOverride(operationId, override);

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

  return { implementation, imports };
};
