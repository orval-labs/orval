import { GeneratorOptions, GeneratorVerbOptions } from '../../types/generator';
import { getMockDefinition, getMockOptionsDataOverride } from './mocks';

const toAxiosPromiseMock = (value: unknown, definition: string) =>
  `Promise.resolve(${value}).then(data => ({data})) as AxiosPromise<${definition}>`;

export const generateAxiosMock = (
  { operationId, response, definitionName, props }: GeneratorVerbOptions,
  { specs, override }: GeneratorOptions,
) => {
  const { definition, definitions } = getMockDefinition(
    operationId,
    response,
    specs,
    override,
    toAxiosPromiseMock,
  );

  const mockData = getMockOptionsDataOverride(operationId, override);

  return `  ${definitionName}(${props.definition}): AxiosPromise<${
    response.definition
  }> {
    return ${
      mockData
        ? toAxiosPromiseMock(mockData, response.definition)
        : definitions.length > 1
        ? `faker.helpers.randomize(${definition})`
        : definitions[0]
    }
  },
`;
};
