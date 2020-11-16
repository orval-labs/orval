import { GeneratorOptions, GeneratorVerbOptions } from '../../types/generator';
import { toObjectString } from '../../utils/string';
import { getMockDefinition, getMockOptionsDataOverride } from './mocks';

const toDelayMock = (value: unknown, definition: string) =>
  `delay<${definition}>(1000)(of(${value}))`;

export const generateAngularMock = (
  { operationId, response, definitionName, props }: GeneratorVerbOptions,
  { specs, override }: GeneratorOptions,
) => {
  const { definition, definitions } = getMockDefinition(
    operationId,
    response,
    specs,
    override,
    toDelayMock,
  );

  const mockData = getMockOptionsDataOverride(operationId, override);

  return `  ${definitionName}(${toObjectString(
    props,
    'definition',
  )}): Observable<${response.definition}> {
    return ${
      mockData
        ? toDelayMock(mockData, response.definition)
        : definitions.length > 1
        ? `faker.helpers.randomize(${definition})`
        : definitions[0]
    }
  }
`;
};
